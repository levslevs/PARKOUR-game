import XCTest

final class GameUITests: XCTestCase {
    func testPlayPauseShopAndPersistentUnlock() {
        continueAfterFailure = false
        XCUIDevice.shared.orientation = .landscapeRight
        let app = XCUIApplication()
        app.launchArguments = ["--ui-test-reset", "--ui-test-coins"]
        app.launch()
        XCUIDevice.shared.orientation = .landscapeRight
        let play = app.webViews.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Let's play")).firstMatch
        XCTAssertTrue(play.waitForExistence(timeout: 20))
        app.webViews.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Character shop")).firstMatch.tap()
        // WebKit exposes aria-pressed character cards as switches on iOS.
        let unlock = app.webViews.switches["Unlock Doughnut for 6 coins"]
        XCTAssertTrue(unlock.waitForExistence(timeout: 10))
        unlock.tap()
        XCTAssertTrue(app.webViews.switches["Doughnut, selected"].waitForExistence(timeout: 5))
        app.terminate()
        app.launchArguments = []
        app.launch()
        XCUIDevice.shared.orientation = .landscapeRight
        XCTAssertTrue(play.waitForExistence(timeout: 20))
        app.webViews.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Character shop")).firstMatch.tap()
        XCTAssertTrue(app.webViews.switches["Doughnut, selected"].waitForExistence(timeout: 10))
        app.webViews.buttons["Back to menu"].tap()
        play.tap()
        XCTAssertTrue(app.webViews.buttons["Move right"].waitForExistence(timeout: 10))
        app.webViews.buttons["Jump"].press(forDuration: 0.3)
        app.webViews.switches["Pause game"].tap()
        let resume = app.webViews.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Keep playing")).firstMatch
        XCTAssertTrue(resume.waitForExistence(timeout: 5))
        resume.tap()
        XCUIDevice.shared.press(.home)
        app.activate()
        XCTAssertTrue(resume.waitForExistence(timeout: 10))
        let screenshot = XCTAttachment(screenshot: app.screenshot())
        screenshot.name = "Native pause after background"
        screenshot.lifetime = .keepAlways
        add(screenshot)
    }

    func testStoreScreenshots() {
        continueAfterFailure = false
        XCUIDevice.shared.orientation = .landscapeRight
        let app = XCUIApplication()
        app.launchArguments = ["--ui-test-reset"]
        app.launch()
        XCUIDevice.shared.orientation = .landscapeRight
        let play = app.webViews.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Let's play")).firstMatch
        XCTAssertTrue(play.waitForExistence(timeout: 20))
        capture(app, name: "store-menu")
        app.webViews.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Character shop")).firstMatch.tap()
        XCTAssertTrue(app.webViews.switches["Blue Cap, selected"].waitForExistence(timeout: 10))
        capture(app, name: "store-characters")
        app.webViews.buttons["Back to menu"].tap()
        play.tap()
        XCTAssertTrue(app.webViews.buttons["Move right"].waitForExistence(timeout: 10))
        capture(app, name: "store-gameplay")
        if min(app.frame.width, app.frame.height) > 700 {
            XCUIDevice.shared.orientation = .portrait
            XCTAssertGreaterThan(app.frame.height, app.frame.width)
            XCTAssertTrue(app.webViews.buttons["Jump"].exists)
            capture(app, name: "store-gameplay-portrait")
        }
    }

    private func capture(_ app: XCUIApplication, name: String) {
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
