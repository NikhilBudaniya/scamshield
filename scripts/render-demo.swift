import AVFoundation
import AppKit
import CoreGraphics
import CoreText
import Foundation
import ImageIO

private struct Scene: Decodable {
    let image: String
    let duration: Double
    let caption: String
}

private struct Project: Decodable {
    let output: String
    let width: Int?
    let height: Int?
    let fps: Int?
    let audio: String?
    let preview: String?
    let scenes: [Scene]
}

private enum RenderError: Error, CustomStringConvertible {
    case usage(String)
    case invalid(String)
    case writer(String)
    case audio(String)

    var description: String {
        switch self {
        case .usage(let message), .invalid(let message), .writer(let message), .audio(let message):
            return message
        }
    }
}

@main
private struct DemoRenderer {
    static func main() async {
        do {
            guard CommandLine.arguments.count >= 2 else {
                throw RenderError.usage("Usage: swiftc -parse-as-library scripts/render-demo.swift -o /tmp/scamshield-render-demo && /tmp/scamshield-render-demo <scene.json>")
            }
            let configURL = URL(fileURLWithPath: CommandLine.arguments[1]).standardizedFileURL
            let project = try JSONDecoder().decode(Project.self, from: Data(contentsOf: configURL))
            try await render(project: project, relativeTo: configURL.deletingLastPathComponent())
        } catch {
            fputs("render-demo: \(error)\n", stderr)
            exit(1)
        }
    }

    private static func render(project: Project, relativeTo root: URL) async throws {
        let width = project.width ?? 1440
        let height = project.height ?? 900
        let fps = project.fps ?? 10
        guard width > 0, height > 0, width % 2 == 0, height % 2 == 0 else {
            throw RenderError.invalid("width and height must be positive even pixel counts")
        }
        guard (1...60).contains(fps) else { throw RenderError.invalid("fps must be between 1 and 60") }
        guard !project.scenes.isEmpty else { throw RenderError.invalid("scenes must contain at least one item") }
        guard project.scenes.allSatisfy({ $0.duration > 0 && $0.duration.isFinite }) else {
            throw RenderError.invalid("each scene needs a positive finite duration")
        }

        let outputURL = resolve(project.output, relativeTo: root)
        let previewURL = project.preview.map { resolve($0, relativeTo: root) }
        let audioURL = project.audio.map { resolve($0, relativeTo: root) }
        try FileManager.default.createDirectory(at: outputURL.deletingLastPathComponent(), withIntermediateDirectories: true)

        let prepared: [(CGImage, String, Int)] = try project.scenes.map { scene in
            let imageURL = resolve(scene.image, relativeTo: root)
            guard let source = CGImageSourceCreateWithURL(imageURL as CFURL, nil),
                  let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
                throw RenderError.invalid("cannot open image: \(imageURL.path)")
            }
            return (image, scene.caption, max(1, Int((scene.duration * Double(fps)).rounded())))
        }

        // This host has no VideoToolbox H.264 encoder available to AVAssetWriter.
        // Pack CGImage JPEG frames into QuickTime, then transcode with Apple's avconvert.
        let videoSourceURL = outputURL.deletingLastPathComponent().appendingPathComponent(".scamshield-video-source.mov")
        try? FileManager.default.removeItem(at: videoSourceURL)
        let writer = try AVAssetWriter(outputURL: videoSourceURL, fileType: .mov)
        var jpegFormatDescription: CMVideoFormatDescription?
        let formatStatus = CMVideoFormatDescriptionCreate(
            allocator: kCFAllocatorDefault,
            codecType: kCMVideoCodecType_JPEG,
            width: Int32(width),
            height: Int32(height),
            extensions: nil,
            formatDescriptionOut: &jpegFormatDescription
        )
        guard formatStatus == noErr, let jpegFormatDescription else {
            throw RenderError.writer("could not create JPEG video format description")
        }
        let input = AVAssetWriterInput(mediaType: .video, outputSettings: nil, sourceFormatHint: jpegFormatDescription)
        input.expectsMediaDataInRealTime = false
        guard writer.canAdd(input) else { throw RenderError.writer("H.264 video input could not be added") }
        writer.add(input)
        guard writer.startWriting() else { throw RenderError.writer("startWriting failed: status=\(writer.status.rawValue), error=\(String(describing: writer.error))") }
        writer.startSession(atSourceTime: .zero)

        var frame = 0
        var previewWritten = false
        for (image, caption, frames) in prepared {
            for _ in 0..<frames {
                while !input.isReadyForMoreMediaData { try await Task.sleep(for: .milliseconds(5)) }
                guard writer.status == .writing else { throw RenderError.writer("writer stopped before append: status=\(writer.status.rawValue), error=\(String(describing: writer.error))") }
                guard let cgImage = makeFrameImage(width: width, height: height, image: image, caption: caption) else {
                    throw RenderError.writer("could not render frame")
                }
                if !previewWritten, let previewURL {
                    try writePNG(image: cgImage, to: previewURL)
                    previewWritten = true
                }
                let time = CMTime(value: CMTimeValue(frame), timescale: CMTimeScale(fps))
                let jpeg = try jpegData(image: cgImage)
                let sampleBuffer = try makeJPEGSampleBuffer(jpeg: jpeg, format: jpegFormatDescription, time: time, fps: fps)
                guard input.append(sampleBuffer) else {
                    throw RenderError.writer("append failed at frame \(frame): status=\(writer.status.rawValue), error=\(String(describing: writer.error))")
                }
                frame += 1
            }
        }
        input.markAsFinished()
        await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
            writer.finishWriting { continuation.resume() }
        }
        guard writer.status == .completed else { throw RenderError.writer(writer.error?.localizedDescription ?? "video finalization failed") }

        let h264URL = outputURL.deletingLastPathComponent().appendingPathComponent(".scamshield-video-only.mp4")
        try runAvconvert(source: videoSourceURL, preset: "PresetHighestQuality", output: h264URL)
        try? FileManager.default.removeItem(at: videoSourceURL)
        if let audioURL {
            try await addAudio(audioURL, to: h264URL, outputURL: outputURL, frameCount: frame, fps: fps)
            try? FileManager.default.removeItem(at: h264URL)
        } else {
            try? FileManager.default.removeItem(at: outputURL)
            try FileManager.default.moveItem(at: h264URL, to: outputURL)
        }
        print("Wrote \(outputURL.path)")
        print("Frames: \(frame)  |  Duration: \(String(format: "%.1f", Double(frame) / Double(fps))) s  |  \(width)×\(height) @ \(fps) fps")
        if let previewURL { print("First-frame preview: \(previewURL.path)") }
    }

    private static func resolve(_ path: String, relativeTo root: URL) -> URL {
        if path.hasPrefix("/") { return URL(fileURLWithPath: path).standardizedFileURL }
        return root.appendingPathComponent(path).standardizedFileURL
    }

    private static func runAvconvert(source: URL, preset: String, output: URL) throws {
        try? FileManager.default.removeItem(at: output)
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/avconvert")
        process.arguments = ["--source", source.path, "--preset", preset, "--output", output.path, "--replace"]
        let errors = Pipe()
        process.standardError = errors
        do {
            try process.run()
        } catch {
            throw RenderError.writer("could not launch avconvert: \(error.localizedDescription)")
        }
        process.waitUntilExit()
        if process.terminationStatus != 0 {
            let detail = String(data: errors.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) ?? ""
            throw RenderError.writer("avconvert failed (\(process.terminationStatus)): \(detail)")
        }
    }

    private static func makeFrameImage(width: Int, height: Int, image: CGImage, caption: String) -> CGImage? {
        guard let context = CGContext(
            data: nil,
            width: width,
            height: height,
            bitsPerComponent: 8,
            bytesPerRow: 0,
            space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGImageAlphaInfo.noneSkipFirst.rawValue
        ) else { return nil }

        context.setFillColor(CGColor(red: 0.075, green: 0.095, blue: 0.086, alpha: 1))
        context.fill(CGRect(x: 0, y: 0, width: width, height: height))

        let captionBand: CGFloat = caption.isEmpty ? 0 : max(118, CGFloat(height) * 0.15)
        let imageBounds = CGRect(x: 48, y: captionBand + 24, width: CGFloat(width) - 96, height: CGFloat(height) - captionBand - 48)
        let scale = min(imageBounds.width / CGFloat(image.width), imageBounds.height / CGFloat(image.height))
        let fitted = CGSize(width: CGFloat(image.width) * scale, height: CGFloat(image.height) * scale)
        let imageRect = CGRect(x: imageBounds.midX - fitted.width / 2, y: imageBounds.midY - fitted.height / 2, width: fitted.width, height: fitted.height)
        context.interpolationQuality = .high
        context.draw(image, in: imageRect)

        if !caption.isEmpty {
            context.setFillColor(CGColor(red: 0.055, green: 0.071, blue: 0.063, alpha: 1))
            context.fill(CGRect(x: 0, y: 0, width: CGFloat(width), height: captionBand))
            drawCaption(caption, in: CGRect(x: 68, y: 20, width: CGFloat(width) - 136, height: captionBand - 36), context: context)
        }
        return context.makeImage()
    }

    private static func drawCaption(_ text: String, in rect: CGRect, context: CGContext) {
        let font = CTFontCreateWithName("HelveticaNeue-Medium" as CFString, 31, nil)
        let paragraph = NSMutableParagraphStyle()
        paragraph.alignment = .center
        paragraph.lineBreakMode = .byWordWrapping
        let attributes: [NSAttributedString.Key: Any] = [
            NSAttributedString.Key(kCTFontAttributeName as String): font,
            NSAttributedString.Key(kCTForegroundColorAttributeName as String): CGColor(red: 0.96, green: 0.97, blue: 0.95, alpha: 1),
            NSAttributedString.Key(kCTParagraphStyleAttributeName as String): paragraph,
        ]
        let attributed = NSAttributedString(string: text, attributes: attributes)
        let framesetter = CTFramesetterCreateWithAttributedString(attributed)
        let path = CGPath(rect: rect, transform: nil)
        CTFrameDraw(CTFramesetterCreateFrame(framesetter, CFRange(location: 0, length: attributed.length), path, nil), context)
    }

    private static func writePNG(image: CGImage, to url: URL) throws {
        guard let destination = CGImageDestinationCreateWithURL(url as CFURL, "public.png" as CFString, 1, nil) else {
            throw RenderError.writer("could not write preview image")
        }
        CGImageDestinationAddImage(destination, image, nil)
        guard CGImageDestinationFinalize(destination) else { throw RenderError.writer("could not finalize preview image") }
    }

    private static func jpegData(image: CGImage) throws -> Data {
        let bytes = NSMutableData()
        guard let destination = CGImageDestinationCreateWithData(bytes, "public.jpeg" as CFString, 1, nil) else {
            throw RenderError.writer("could not create JPEG frame encoder")
        }
        CGImageDestinationAddImage(destination, image, [kCGImageDestinationLossyCompressionQuality: 0.82] as CFDictionary)
        guard CGImageDestinationFinalize(destination) else { throw RenderError.writer("could not encode JPEG frame") }
        return bytes as Data
    }

    private static func makeJPEGSampleBuffer(jpeg: Data, format: CMVideoFormatDescription, time: CMTime, fps: Int) throws -> CMSampleBuffer {
        var blockBuffer: CMBlockBuffer?
        let createStatus = CMBlockBufferCreateWithMemoryBlock(
            allocator: kCFAllocatorDefault,
            memoryBlock: nil,
            blockLength: jpeg.count,
            blockAllocator: kCFAllocatorDefault,
            customBlockSource: nil,
            offsetToData: 0,
            dataLength: jpeg.count,
            flags: 0,
            blockBufferOut: &blockBuffer
        )
        guard createStatus == noErr, let blockBuffer else { throw RenderError.writer("could not allocate compressed frame buffer") }
        let copyStatus = jpeg.withUnsafeBytes { buffer in
            CMBlockBufferReplaceDataBytes(
                with: buffer.baseAddress!,
                blockBuffer: blockBuffer,
                offsetIntoDestination: 0,
                dataLength: jpeg.count
            )
        }
        guard copyStatus == noErr else { throw RenderError.writer("could not copy compressed frame bytes") }

        var timing = CMSampleTimingInfo(duration: CMTime(value: 1, timescale: CMTimeScale(fps)), presentationTimeStamp: time, decodeTimeStamp: .invalid)
        var sampleSize = jpeg.count
        var sampleBuffer: CMSampleBuffer?
        let sampleStatus = CMSampleBufferCreateReady(
            allocator: kCFAllocatorDefault,
            dataBuffer: blockBuffer,
            formatDescription: format,
            sampleCount: 1,
            sampleTimingEntryCount: 1,
            sampleTimingArray: &timing,
            sampleSizeEntryCount: 1,
            sampleSizeArray: &sampleSize,
            sampleBufferOut: &sampleBuffer
        )
        guard sampleStatus == noErr, let sampleBuffer else { throw RenderError.writer("could not create compressed video sample") }
        return sampleBuffer
    }

    private static func addAudio(_ audioURL: URL, to videoURL: URL, outputURL: URL, frameCount: Int, fps: Int) async throws {
        let composition = AVMutableComposition()
        let videoAsset = AVURLAsset(url: videoURL)
        let videoTracks = try await videoAsset.loadTracks(withMediaType: .video)
        guard let sourceVideo = videoTracks.first,
              let destinationVideo = composition.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid) else {
            throw RenderError.audio("could not open encoded video track")
        }
        let duration = CMTime(value: CMTimeValue(frameCount), timescale: CMTimeScale(fps))
        try destinationVideo.insertTimeRange(CMTimeRange(start: .zero, duration: duration), of: sourceVideo, at: .zero)

        let normalizedAudioURL = outputURL.deletingLastPathComponent().appendingPathComponent(".scamshield-narration.m4a")
        try runAvconvert(source: audioURL, preset: "PresetAppleM4A", output: normalizedAudioURL)
        let audioAsset = AVURLAsset(url: normalizedAudioURL)
        let audioTracks = try await audioAsset.loadTracks(withMediaType: .audio)
        guard let sourceAudio = audioTracks.first,
              let destinationAudio = composition.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid) else {
            throw RenderError.audio("could not open narration audio track")
        }
        let audioDuration = try await audioAsset.load(.duration)
        let usableDuration = CMTimeMinimum(audioDuration, duration)
        try destinationAudio.insertTimeRange(CMTimeRange(start: .zero, duration: usableDuration), of: sourceAudio, at: .zero)

        try? FileManager.default.removeItem(at: outputURL)
        guard let exporter = AVAssetExportSession(asset: composition, presetName: AVAssetExportPresetPassthrough) else {
            throw RenderError.audio("could not create MP4 muxer")
        }
        exporter.outputURL = outputURL
        exporter.outputFileType = .mp4
        await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
            exporter.exportAsynchronously { continuation.resume() }
        }
        guard exporter.status == .completed else {
            throw RenderError.audio(exporter.error?.localizedDescription ?? "could not mux narration")
        }
        try? FileManager.default.removeItem(at: normalizedAudioURL)
    }
}
