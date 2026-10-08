import Foundation

final class ProgressStore {
    static let keys = ["parkourEnemies", "parkourEnemiesSound"]
    private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) { self.defaults = defaults }

    var snapshot: [String: String] {
        Dictionary(uniqueKeysWithValues: Self.keys.compactMap { key in
            defaults.string(forKey: key).map { (key, $0) }
        })
    }

    @discardableResult
    func save(key: String, value: String) -> Bool {
        guard Self.keys.contains(key), value.utf8.count <= 16_384 else { return false }
        if key == "parkourEnemiesSound" {
            guard ["on", "off"].contains(value) else { return false }
        } else {
            guard let data = value.data(using: .utf8),
                  (try? JSONSerialization.jsonObject(with: data)) is [String: Any] else { return false }
        }
        defaults.set(value, forKey: key)
        return true
    }
}
