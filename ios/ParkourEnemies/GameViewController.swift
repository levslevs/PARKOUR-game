import UIKit
import WebKit
import AVFAudio

final class GameViewController: UIViewController, WKNavigationDelegate, WKScriptMessageHandler {
    private let progress = ProgressStore()
    private var webView: WKWebView!
    private let background = UIColor(red: 17/255, green: 28/255, blue: 50/255, alpha: 1)
    override var prefersStatusBarHidden: Bool { true }
    override var prefersHomeIndicatorAutoHidden: Bool { true }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = background
        // Sound follows the silent switch and mixes with the player's own audio.
        try? AVAudioSession.sharedInstance().setCategory(.ambient, mode: .default)
        try? AVAudioSession.sharedInstance().setActive(true)

        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains("--ui-test-reset") {
            for key in ProgressStore.keys { UserDefaults.standard.removeObject(forKey: key) }
        }
        if ProcessInfo.processInfo.arguments.contains("--ui-test-coins") {
            progress.save(key: "parkourEnemies", value: #"{"coins":24,"owned":["blue"],"skin":"blue","best":1}"#)
        }
        #endif

        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .nonPersistent()
        configuration.allowsInlineMediaPlayback = true
        let snapshot = (try? JSONSerialization.data(withJSONObject: progress.snapshot)) ?? Data("{}".utf8)
        let encoded = String(decoding: snapshot, as: UTF8.self)
        let script = "window.parkourNative = {values: \(encoded)};"
        configuration.userContentController.addUserScript(WKUserScript(source: script,
            injectionTime: .atDocumentStart, forMainFrameOnly: true))
        configuration.userContentController.add(self, name: "parkour")
        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = self
        webView.isOpaque = false
        webView.backgroundColor = background
        webView.scrollView.backgroundColor = background
        webView.scrollView.bounces = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.allowsLinkPreview = false
        #if DEBUG
        if #available(iOS 16.4, *) { webView.isInspectable = true }
        #endif
        webView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(webView)
        NSLayoutConstraint.activate([
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            webView.topAnchor.constraint(equalTo: view.topAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
        loadGame()
    }

    private func loadGame() {
        guard let url = Bundle.main.url(forResource: "parkour-enemies", withExtension: "html") else {
            showLoadError(); return
        }
        webView.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
    }

    func pause() {
        webView?.evaluateJavaScript("window.dispatchEvent(new Event('parkourPause'));", completionHandler: nil)
    }

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame, message.frameInfo.request.url?.isFileURL == true,
              let body = message.body as? [String: Any], let action = body["action"] as? String else { return }
        if action == "save", let key = body["key"] as? String, let value = body["value"] as? String {
            progress.save(key: key, value: value)
        } else if action == "about" { showAbout() }
    }

    private func showAbout() {
        pause()
        let alert = UIAlertController(title: "Parkour Enemies", message:
            "Published by WaiWai, LLC\n\nJump across five island courses and collect six heroes. All characters are unlocked with coins earned in play.\n\nPrivacy: the game collects no personal data and contains no ads, analytics, accounts or real-money purchases. Progress and sound settings are saved on this device. Removing the app removes its local progress.\n\nVersion 1.0", preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Privacy policy", style: .default) { _ in
            self.openSupportPage("privacy")
        })
        alert.addAction(UIAlertAction(title: "Support", style: .default) { _ in
            self.openSupportPage("support")
        })
        alert.addAction(UIAlertAction(title: "Done", style: .cancel))
        present(alert, animated: true)
    }

    private func openSupportPage(_ page: String) {
        guard let url = URL(string: "https://github.com/levslevs/PARKOUR-game/blob/main/docs/\(page).md") else { return }
        UIApplication.shared.open(url)
    }

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        // The game is shipped in the bundle; web navigation never replaces its code.
        decisionHandler(action.request.url?.isFileURL == true ? .allow : .cancel)
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        let alert = UIAlertController(title: "Let's jump back in", message:
            "The game needs to restart. Your coins and characters are safe.", preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Restart", style: .default) { _ in
            self.webView.configuration.userContentController.removeAllUserScripts()
            let data = (try? JSONSerialization.data(withJSONObject: self.progress.snapshot)) ?? Data("{}".utf8)
            self.webView.configuration.userContentController.addUserScript(WKUserScript(
                source: "window.parkourNative = {values: \(String(decoding: data, as: UTF8.self))};",
                injectionTime: .atDocumentStart, forMainFrameOnly: true))
            self.loadGame()
        })
        if presentedViewController == nil { present(alert, animated: true) }
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        showLoadError()
    }

    private func showLoadError() {
        guard presentedViewController == nil else { return }
        let alert = UIAlertController(title: "Unable to start the game", message: "Please close and reopen Parkour Enemies.", preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "Retry", style: .default) { _ in self.loadGame() })
        present(alert, animated: true)
    }
}
