import './style.css';
import { Game } from './game/Game.js';

const game = new Game(document.getElementById('app'));
window.__game = game;
game.boot();
