import XCTest

final class GameUITests: XCTestCase {
    private var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        XCUIDevice.shared.orientation = .portrait
        app = XCUIApplication()
        app.launch()
    }

    override func tearDownWithError() throws {
        if let app, testRun?.hasSucceeded == false {
            let screenshot = XCTAttachment(screenshot: app.screenshot())
            screenshot.lifetime = .keepAlways
            add(screenshot)
            let hierarchy = XCTAttachment(string: app.debugDescription)
            hierarchy.lifetime = .keepAlways
            add(hierarchy)
        }
    }

    func testTouchPlayPauseRotationAndBackground() throws {
        let play = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Let's play")).firstMatch
        XCTAssertTrue(play.waitForExistence(timeout: 30))
        let ready = XCTNSPredicateExpectation(predicate: NSPredicate(format: "enabled == true"), object: play)
        XCTAssertEqual(XCTWaiter.wait(for: [ready], timeout: 30), .completed)
        play.tap()
        let pause = app.switches["Pause game"]
        XCTAssertTrue(pause.waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["Move left"].exists)
        XCTAssertTrue(app.buttons["Move right"].exists)
        XCTAssertTrue(app.buttons["Jump"].exists)
        pause.tap()
        let resume = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Keep playing")).firstMatch
        XCTAssertTrue(resume.waitForExistence(timeout: 5))
        resume.tap()
        XCUIDevice.shared.orientation = .landscapeLeft
        XCTAssertTrue(resume.waitForExistence(timeout: 5))
        resume.tap()
        XCUIDevice.shared.press(.home)
        app.activate()
        XCTAssertTrue(resume.waitForExistence(timeout: 10))
        resume.tap()
        XCTAssertTrue(pause.waitForExistence(timeout: 5))
    }

    func testSoundChoiceSurvivesRelaunch() throws {
        let sound = app.switches["Toggle sound"].firstMatch
        XCTAssertTrue(sound.waitForExistence(timeout: 30))
        let before = try XCTUnwrap(sound.value as? String)
        sound.tap()
        let changed = XCTNSPredicateExpectation(predicate: NSPredicate(format: "value != %@", before), object: sound)
        XCTAssertEqual(XCTWaiter.wait(for: [changed], timeout: 5), .completed)
        let after = try XCTUnwrap(sound.value as? String)
        XCTAssertNotEqual(before, after)
        app.terminate()
        app.launch()
        XCTAssertTrue(sound.waitForExistence(timeout: 30))
        XCTAssertEqual(sound.value as? String, after)
    }
}
