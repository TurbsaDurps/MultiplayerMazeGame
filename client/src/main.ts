import { GameClient } from './game/GameClient';

// Initialize the game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const gameClient = new GameClient();
    gameClient.initialize();
});