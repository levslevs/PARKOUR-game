import XCTest
@testable import ParkourEnemies

final class ProgressStoreTests: XCTestCase {
    func testProgressSurvivesNewStoreAndRejectsInvalidWrites() throws {
        let suite = "ParkourEnemies.tests.\(UUID().uuidString)"
        let defaults = try XCTUnwrap(UserDefaults(suiteName: suite))
        defer { defaults.removePersistentDomain(forName: suite) }
        let store = ProgressStore(defaults: defaults)
        let value = #"{"coins":18,"owned":["blue","frog"],"skin":"frog","best":3}"#
        XCTAssertTrue(store.save(key: "parkourEnemies", value: value))
        XCTAssertTrue(store.save(key: "parkourEnemiesSound", value: "on"))
        XCTAssertFalse(store.save(key: "unrelated", value: "anything"))
        XCTAssertFalse(store.save(key: "parkourEnemies", value: "broken JSON"))
        XCTAssertFalse(store.save(key: "parkourEnemiesSound", value: "invalid"))
        XCTAssertFalse(store.save(key: "parkourEnemies", value: String(repeating: "a", count: 17000)))
        let restored = ProgressStore(defaults: defaults)
        XCTAssertEqual(restored.snapshot, ["parkourEnemies": value, "parkourEnemiesSound": "on"])
    }
}
