import Foundation

/// Keeps the game's small local save outside WKWebView's website data store.
final class NativeSaveStore {
    private static let storagePrefix = "game.store."
    private static let saveKey = "parkourEnemies"
    private static let soundKey = "parkourEnemiesSound"
    private static let allowedKeys = [saveKey, soundKey]
    private static let maximumByteCount = 64 * 1024

    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
    }

    var snapshot: [String: String] {
        var result: [String: String] = [:]
        for key in Self.allowedKeys {
            if let value = defaults.string(forKey: Self.storagePrefix + key),
               Self.isValid(value, forKey: key) {
                result[key] = value
            }
        }
        return result
    }

    @discardableResult
    func set(_ value: String, forKey key: String) -> Bool {
        guard Self.isValid(value, forKey: key) else { return false }
        defaults.set(value, forKey: Self.storagePrefix + key)
        return true
    }

    func injectionScript(isActive: Bool) -> String {
        // Serialize the complete dictionary rather than interpolating save strings.
        // Escaping '<' also keeps the result safe if embedded in an HTML script.
        let data = try? JSONSerialization.data(withJSONObject: snapshot, options: [.sortedKeys])
        let json = data.flatMap { String(data: $0, encoding: .utf8) } ?? "{}"
        let safeJSON = json
            .replacingOccurrences(of: "<", with: "\\u003C")
            .replacingOccurrences(of: "\u{2028}", with: "\\u2028")
            .replacingOccurrences(of: "\u{2029}", with: "\\u2029")

        return """
        window.__PARKOUR_IOS__ = true;
        window.__PARKOUR_ACTIVE__ = \(isActive ? "true" : "false");
        window.__PARKOUR_SAVED__ = \(safeJSON);
        """
    }

    private static func isValid(_ value: String, forKey key: String) -> Bool {
        guard allowedKeys.contains(key),
              let data = value.data(using: .utf8),
              data.count <= maximumByteCount else { return false }

        if key == soundKey {
            return value == "on" || value == "off"
        }

        guard let object = try? JSONSerialization.jsonObject(with: data) else { return false }
        return object is [String: Any]
    }
}
