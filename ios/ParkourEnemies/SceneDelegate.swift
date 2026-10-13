import UIKit

final class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?
    private var game: GameViewController?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession,
               options connectionOptions: UIScene.ConnectionOptions) {
        guard let scene = scene as? UIWindowScene else { return }
        let controller = GameViewController()
        let window = UIWindow(windowScene: scene)
        window.rootViewController = controller
        self.window = window
        game = controller
        window.makeKeyAndVisible()
    }

    func sceneWillResignActive(_ scene: UIScene) { game?.setActive(false) }
    func sceneDidEnterBackground(_ scene: UIScene) { game?.setActive(false) }
    func sceneDidBecomeActive(_ scene: UIScene) { game?.setActive(true) }
}
