import Foundation
import AppKit
import PDFKit
import Vision

func makeRequest() -> VNRecognizeTextRequest {
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.recognitionLanguages = ["zh-Hans", "en-US"]
    request.usesLanguageCorrection = true
    return request
}

func resultText(_ request: VNRecognizeTextRequest) -> String {
    let observations = request.results ?? []
    return observations.sorted {
        if abs($0.boundingBox.midY - $1.boundingBox.midY) > 0.015 { return $0.boundingBox.midY > $1.boundingBox.midY }
        return $0.boundingBox.minX < $1.boundingBox.minX
    }.compactMap { $0.topCandidates(1).first?.string }.joined(separator: "\n")
}

func recognize(_ image: CGImage) -> String {
    let request = makeRequest()
    do {
        try VNImageRequestHandler(cgImage: image).perform([request])
        return resultText(request)
    } catch {
        fputs("OCR error: \(error)\n", stderr)
        return ""
    }
}

func recognizeURL(_ url: URL) -> String {
    let request = makeRequest()
    do {
        try VNImageRequestHandler(url: url).perform([request])
        return resultText(request)
    } catch {
        fputs("OCR error: \(error)\n", stderr)
        return ""
    }
}

func pdfText(_ url: URL) -> String {
    guard let document = PDFDocument(url: url) else { return "" }
    var pages: [String] = []
    for index in 0..<min(document.pageCount, 160) {
        guard let page = document.page(at: index) else { continue }
        let bounds = page.bounds(for: .mediaBox)
        let scale: CGFloat = 2.0
        let width = max(1, Int(bounds.width * scale)), height = max(1, Int(bounds.height * scale))
        guard let context = CGContext(data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { continue }
        context.setFillColor(NSColor.white.cgColor); context.fill(CGRect(x: 0, y: 0, width: width, height: height))
        context.scaleBy(x: scale, y: scale); page.draw(with: .mediaBox, to: context)
        if let image = context.makeImage() {
            let text = recognize(image)
            if !text.isEmpty { pages.append("[第\(index + 1)页 OCR]\n\(text)") }
        }
    }
    return pages.joined(separator: "\n\n")
}

func renderPDF(_ url: URL, output: URL) -> Int {
    guard let document = PDFDocument(url: url) else { return 0 }
    try? FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)
    var rendered = 0
    for index in 0..<min(document.pageCount, 80) {
        guard let page = document.page(at: index) else { continue }
        let bounds = page.bounds(for: .mediaBox)
        let scale: CGFloat = 1.6
        let width = max(1, Int(bounds.width * scale)), height = max(1, Int(bounds.height * scale))
        guard let context = CGContext(data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { continue }
        context.setFillColor(NSColor.white.cgColor); context.fill(CGRect(x: 0, y: 0, width: width, height: height))
        context.scaleBy(x: scale, y: scale); page.draw(with: .mediaBox, to: context)
        guard let image = context.makeImage() else { continue }
        let bitmap = NSBitmapImageRep(cgImage: image)
        guard let data = bitmap.representation(using: .jpeg, properties: [.compressionFactor: 0.82]) else { continue }
        let target = output.appendingPathComponent(String(format: "page-%03d.jpg", index + 1))
        do { try data.write(to: target); rendered += 1 } catch {}
    }
    return rendered
}

guard CommandLine.arguments.count > 1 else { exit(1) }
let url = URL(fileURLWithPath: CommandLine.arguments[1])
if CommandLine.arguments.count > 3 && CommandLine.arguments[1] == "--render-pdf" {
    let input = URL(fileURLWithPath: CommandLine.arguments[2])
    let output = URL(fileURLWithPath: CommandLine.arguments[3], isDirectory: true)
    print(renderPDF(input, output: output))
} else if url.pathExtension.lowercased() == "pdf" {
    print(pdfText(url))
} else {
    print(recognizeURL(url))
}
