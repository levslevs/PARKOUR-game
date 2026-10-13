// Regenerate on macOS: swift tools/generate_ios_icon.swift
// The three stepping blocks match the game's existing header mark.
import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

let size = 1024
let space = CGColorSpace(name: CGColorSpace.sRGB)!
let context = CGContext(data: nil, width: size, height: size, bitsPerComponent: 8,
                        bytesPerRow: size * 4, space: space,
                        bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
let background = CGColor(srgbRed: 0.067, green: 0.075, blue: 0.137, alpha: 1)
let light = CGColor(srgbRed: 0.23, green: 0.30, blue: 0.40, alpha: 1)
context.setFillColor(background)
context.fill(CGRect(x: 0, y: 0, width: size, height: size))
let gradient = CGGradient(colorsSpace: space, colors: [light, background] as CFArray, locations: [0, 1])!
context.drawLinearGradient(gradient, start: CGPoint(x: 0, y: 1024), end: CGPoint(x: 1024, y: 0), options: [])
for (x, y) in [(160.0, 255.0), (400.0, 435.0), (640.0, 615.0)] {
    context.setFillColor(CGColor(srgbRed: 0.15, green: 0.40, blue: 0.38, alpha: 1))
    context.addPath(CGPath(roundedRect: CGRect(x: x, y: y - 28, width: 220, height: 160), cornerWidth: 34, cornerHeight: 34, transform: nil))
    context.fillPath()
    context.setFillColor(CGColor(srgbRed: 0.63, green: 0.95, blue: 0.81, alpha: 1))
    context.addPath(CGPath(roundedRect: CGRect(x: x, y: y, width: 220, height: 160), cornerWidth: 34, cornerHeight: 34, transform: nil))
    context.fillPath()
}
for i in 0..<8 {
    let angle = Double(i) * .pi / 4
    let radius = i % 2 == 0 ? 85.0 : 28.0
    let point = CGPoint(x: 278 + cos(angle) * radius, y: 720 + sin(angle) * radius)
    if i == 0 { context.move(to: point) } else { context.addLine(to: point) }
}
context.closePath()
context.setFillColor(CGColor(srgbRed: 1, green: 0.84, blue: 0.48, alpha: 1))
context.fillPath()
let target = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
    .appendingPathComponent("ios/ParkourEnemies/Assets.xcassets/AppIcon.appiconset/AppIcon.png")
try FileManager.default.createDirectory(at: target.deletingLastPathComponent(), withIntermediateDirectories: true)
let destination = CGImageDestinationCreateWithURL(target as CFURL, UTType.png.identifier as CFString, 1, nil)!
CGImageDestinationAddImage(destination, context.makeImage()!, nil)
precondition(CGImageDestinationFinalize(destination), "Could not write icon")
print("Built \(target.path)")
