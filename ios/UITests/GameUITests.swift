import XCTest

final class GameUITests: XCTestCase {
    func testPlayPauseShopAndPersistentUnlock() {
        continueAfterFailure = false
        XCUIDevice.shared.orientation = .landscapeLeft
        let app = XCUIApplication()
        app.launchArguments = ["--ui-test-reset", "--ui-test-coins"]
        app.launch()
        let play = app.webViews.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Let's play")).firstMatch
        XCTAssertTrue(play.waitForExistence(timeout: 20))
        app.webViews.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Character shop")).firstMatch.tap()
        let unlock = app.webViews.buttons["Unlock Doughnut for 6 coins"]
        XCTAssertTrue(unlock.waitForExistence(timeout: 10))
        unlock.tap()
        XCTAssertTrue(app.webViews.buttons["Doughnut, selected"].waitForExistence(timeout: 5))
        app.terminate()
        app.launchArguments = []
        app.launch()
        XCTAssertTrue(play.waitForExistence(timeout: 20))
        app.webViews.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Character shop")).firstMatch.tap()
        XCTAssertTrue(app.webViews.buttons["Doughnut, selected"].waitForExistence(timeout: 10))
        app.webViews.buttons["Back to menu"].tap()
        play.tap()
        XCTAssertTrue(app.webViews.buttons["Move right"].waitForExistence(timeout: 10))
        app.webViews.buttons["Jump"].press(forDuration: 0.3)
        app.webViews.buttons["Pause game"].tap()
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
}
