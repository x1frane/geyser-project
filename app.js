// Танковая Битва - Онлайн игра

// Состояние игры
let gameState = {
  phase: 'menu', // menu, searching, placement, battle, finished
  playerId: null,
  playerNumber: null, // 1 или 2
  opponentId: null,
  currentTurn: null,
  isMyTurn: false,
  selectedUnit: null,
  activeUnit: null,
  activeIndex: null,
  infantryCount: 10,
  tankCount: 3,
  ready: false,
  opponentReady: false,
  shootingMode: false,
  selectedShooter: null
};

// WebSocket соединение
let socket = null;

// Инициализация игры
document.addEventListener('DOMContentLoaded', function() {
  initializeGame();
});

function initializeGame() {
  // Создаем поле боя
  createBattlefield();
  
  // Добавляем обработчики событий
  setupEventListeners();
  
  // Показываем главное меню
  showMainMenu();
}

function createBattlefield() {
  const battlefield = document.getElementById("battlefield");
  battlefield.innerHTML = '';
  
  for (let i = 0; i < 400; i++) {
    const cell = document.createElement("div");
    cell.classList.add("cell");
    cell.dataset.index = i;
    battlefield.appendChild(cell);
  }
  
  // Добавляем зоны игроков
  addPlayerAreas();
}

function addPlayerAreas() {
  const battlefield = document.getElementById("battlefield");
  
  // Зона игрока 1 (верхняя половина)
  const player1Area = document.createElement("div");
  player1Area.classList.add("player-area", "player1");
  player1Area.innerHTML = '<div class="player-area-label">Ваша зона</div>';
  battlefield.appendChild(player1Area);
  
  // Зона игрока 2 (нижняя половина)
  const player2Area = document.createElement("div");
  player2Area.classList.add("player-area", "player2");
  player2Area.innerHTML = '<div class="player-area-label">Зона соперника</div>';
  battlefield.appendChild(player2Area);
}

function setupEventListeners() {
  // Кнопки главного меню
  document.getElementById('find-match-btn').addEventListener('click', findMatch);
  document.getElementById('cancel-search-btn').addEventListener('click', cancelSearch);
  document.getElementById('test-match-btn').addEventListener('click', startTestMatch);
  
  // Кнопки игры
  document.getElementById('ready-btn').addEventListener('click', toggleReady);
  document.getElementById('end-turn-btn').addEventListener('click', endTurn);
  
  // Поле боя
  const battlefield = document.getElementById("battlefield");
  battlefield.addEventListener("click", handleBattlefieldClick);
}

function showMainMenu() {
  document.getElementById('main-menu').style.display = 'block';
  document.getElementById('game-area').style.display = 'none';
  gameState.phase = 'menu';
}

function showGameArea() {
  document.getElementById('main-menu').style.display = 'none';
  document.getElementById('game-area').style.display = 'flex';
}

function findMatch() {
  // Подключаемся к WebSocket серверу
  if (!socket) {
    socket = new WebSocket('ws://localhost:3000'); // Замените на адрес вашего сервера
    
    socket.onopen = () => {
      console.log('Подключено к серверу');
      // Отправляем запрос на поиск игры
      socket.send(JSON.stringify({
        type: 'find_match'
      }));
    };
    
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      switch(message.type) {
        case 'match_found':
          // Когда найден противник
          startMatch(message.playerId, message.opponentId);
          break;
        case 'match_error':
          alert('Ошибка при поиске противника: ' + message.error);
          cancelSearch();
          break;
      }
    };
    
    socket.onerror = (error) => {
      console.error('Ошибка WebSocket:', error);
      alert('Ошибка подключения к серверу');
      cancelSearch();
    };
  }
  
  document.getElementById('find-match-btn').style.display = 'none';
  document.getElementById('searching-status').style.display = 'block';
  gameState.phase = 'searching';
}

function cancelSearch() {
  if (socket) {
    socket.send(JSON.stringify({
      type: 'cancel_search'
    }));
    socket.close();
    socket = null;
  }
  document.getElementById('find-match-btn').style.display = 'block';
  document.getElementById('searching-status').style.display = 'none';
  gameState.phase = 'menu';
}

function startTestMatch() {
  startMatch('player1', 'player2');
}

function startMatch(player1Id, player2Id) {
  gameState.playerId = player1Id;
  gameState.playerNumber = 1;
  gameState.opponentId = player2Id;
  gameState.currentTurn = 1;
  gameState.isMyTurn = true;
  
  showGameArea();
  startPlacementPhase();
}

function startPlacementPhase() {
  gameState.phase = 'placement';
  document.getElementById('placement-menu').style.display = 'block';
  document.getElementById('battle-menu').style.display = 'none';
  
  // Обновляем информацию о игроках
  document.getElementById('player-name').textContent = `Игрок ${gameState.playerNumber}`;
  document.getElementById('opponent-name').textContent = `Игрок ${gameState.playerNumber === 1 ? 2 : 1}`;
  document.getElementById('current-turn').textContent = 'Расстановка юнитов';
  
  // Скрываем зоны игроков во время расстановки
  document.querySelectorAll('.player-area').forEach(area => {
    area.style.display = 'none';
  });
}

// Функции для выбора юнитов
function selectUnit(type) {
  if (gameState.phase !== 'placement') return;
  
  gameState.selectedUnit = type;
  
  // Обновляем визуальное выделение кнопок
  document.querySelectorAll('#placement-menu button').forEach(btn => {
    btn.style.backgroundColor = '#4a7c59';
  });
  
  if (type === 'infantry') {
    document.querySelector('button[onclick="selectUnit(\'infantry\')"]').style.backgroundColor = '#2d4a35';
  } else if (type === 'tank') {
    document.querySelector('button[onclick="selectUnit(\'tank\')"]').style.backgroundColor = '#2d4a35';
  }
}

// Обработчик кликов по полю боя
function handleBattlefieldClick(e) {
  const cell = e.target.closest(".cell");
  if (!cell) return;
  
  const index = parseInt(cell.dataset.index);
  
  if (gameState.phase === 'placement') {
    handlePlacementClick(index, cell);
  } else if (gameState.phase === 'battle') {
    handleBattleClick(index, cell);
  }
}

function handlePlacementClick(index, cell) {
  // Проверяем, что игрок размещает юниты только в своей зоне
  if (!isInPlayerZone(index)) {
    alert('Вы можете размещать юниты только в своей зоне!');
    return;
  }
  
  if (gameState.selectedUnit === 'tank' && gameState.tankCount > 0) {
    if (placeTank(index)) {
      gameState.tankCount--;
      document.getElementById("tank-count").textContent = gameState.tankCount;
      checkReadyButton();
    }
    return;
  }
  
  if (gameState.selectedUnit === 'infantry' && gameState.infantryCount > 0 && !cell.querySelector(".unit")) {
    placeUnit(index, gameState.selectedUnit);
    gameState.infantryCount--;
    document.getElementById("infantry-count").textContent = gameState.infantryCount;
    checkReadyButton();
    return;
  }
  
  // Перемещение юнитов
  if (cell.querySelector(".unit") && !gameState.activeUnit) {
    const unit = cell.querySelector(".unit");
    gameState.activeUnit = unit;
    gameState.activeIndex = index;
    
    // Если это танк, выделяем все его части
    if (unit.classList.contains("tank")) {
      const tankId = unit.dataset.tankId;
      const tankParts = document.querySelectorAll(`[data-tank-id="${tankId}"]`);
      tankParts.forEach(part => {
        const partCell = part.closest(".cell");
        partCell.classList.add("selected");
      });
    } else {
      cell.classList.add("selected");
    }
    return;
  }
  
  if (gameState.activeUnit && isCellEmpty(index) && canMove(gameState.activeIndex, index)) {
    if (gameState.activeUnit.classList.contains("tank")) {
      if (canMoveTank(gameState.activeIndex, index)) {
        moveTank(gameState.activeIndex, index);
        endTurnAfterAction();
      }
    } else {
      if (canMove(gameState.activeIndex, index)) {
        cell.appendChild(gameState.activeUnit);
        endTurnAfterAction();
      }
    }
    
    // Убираем выделение
    document.querySelectorAll(".selected").forEach(el => el.classList.remove("selected"));
    gameState.activeUnit = null;
    gameState.activeIndex = null;
  }
}

function handleBattleClick(index, cell) {
  if (!gameState.isMyTurn) return;
  
  if (gameState.shootingMode) {
    handleShooting(index, cell);
  } else {
    handleMovement(index, cell);
  }
}

function handleShooting(index, cell) {
  const unit = cell.querySelector(".unit");
  if (!unit) return;
  
  // Проверяем, что стреляем по врагу
  if (isInPlayerZone(index)) {
    alert('Нельзя стрелять по своим юнитам!');
    return;
  }
  
  // Выполняем выстрел
  shootAtTarget(gameState.selectedShooter, index);
}

function handleMovement(index, cell) {
  // Логика перемещения во время боя (аналогично расстановке)
  if (cell.querySelector(".unit") && !gameState.activeUnit) {
    const unit = cell.querySelector(".unit");
    gameState.activeUnit = unit;
    gameState.activeIndex = index;
    
    // Если это танк, выделяем все его части
    if (unit.classList.contains("tank")) {
      const tankId = unit.dataset.tankId;
      const tankParts = document.querySelectorAll(`[data-tank-id="${tankId}"]`);
      tankParts.forEach(part => {
        const partCell = part.closest(".cell");
        partCell.classList.add("selected");
      });
    } else {
      cell.classList.add("selected");
    }
    return;
  }
  
  if (gameState.activeUnit && isCellEmpty(index) && canMove(gameState.activeIndex, index)) {
    if (gameState.activeUnit.classList.contains("tank")) {
      if (canMoveTank(gameState.activeIndex, index)) {
        moveTank(gameState.activeIndex, index);
        endTurnAfterAction();
      }
    } else {
      if (canMove(gameState.activeIndex, index)) {
        cell.appendChild(gameState.activeUnit);
        endTurnAfterAction();
      }
    }
    
    // Убираем выделение
    document.querySelectorAll(".selected").forEach(el => el.classList.remove("selected"));
    gameState.activeUnit = null;
    gameState.activeIndex = null;
  }
}

function isInPlayerZone(index) {
  const y = Math.floor(index / 20);
  if (gameState.playerNumber === 1) {
    return y < 10; // Верхняя половина для игрока 1
  } else {
    return y >= 10; // Нижняя половина для игрока 2
  }
}

function checkReadyButton() {
  if (gameState.tankCount === 0 && gameState.infantryCount === 0) {
    document.getElementById('ready-btn').style.display = 'block';
  }
}

function toggleReady() {
  gameState.ready = true;
  document.getElementById('ready-btn').textContent = 'Ожидание соперника...';
  document.getElementById('ready-btn').disabled = true;
  
  // Симулируем готовность соперника
  setTimeout(() => {
    startBattlePhase();
  }, 1000);
}

function startBattlePhase() {
  gameState.phase = 'battle';
  gameState.opponentReady = true;
  
  document.getElementById('placement-menu').style.display = 'none';
  document.getElementById('battle-menu').style.display = 'block';
  
  // Показываем зоны игроков
  document.querySelectorAll('.player-area').forEach(area => {
    area.style.display = 'block';
  });
  
  updateTurnDisplay();
}

function updateTurnDisplay() {
  if (gameState.isMyTurn) {
    document.getElementById('current-turn').textContent = 'Ваш ход';
  } else {
    document.getElementById('current-turn').textContent = 'Ход соперника';
  }
}

function endTurn() {
  gameState.isMyTurn = false;
  gameState.shootingMode = false;
  gameState.selectedShooter = null;
  
  // Симулируем ход соперника
  setTimeout(() => {
    gameState.isMyTurn = true;
    updateTurnDisplay();
  }, 2000);
}

function endTurnAfterAction() {
  // Автоматически завершаем ход после каждого действия
  if (gameState.phase === 'battle') {
    endTurn();
  }
}

function shootAtTarget(shooterIndex, targetIndex) {
  const targetCell = document.querySelector(`.cell[data-index='${targetIndex}']`);
  const targetUnit = targetCell.querySelector(".unit");
  
  if (targetUnit) {
    // Уничтожаем цель
    targetUnit.remove();
    alert('Попадание! Юнит уничтожен!');
  } else {
    alert('Промах!');
  }
  
  gameState.shootingMode = false;
  gameState.selectedShooter = null;
  
  // Завершаем ход после выстрела
  endTurnAfterAction();
}

// Вспомогательные функции для игры

function placeUnit(index, type) {
    const cell = document.querySelector(`.cell[data-index='${index}']`);
    if (!cell.querySelector(".unit")) {
      const unit = document.createElement("div");
      unit.classList.add("unit", type);
      cell.appendChild(unit);
    }
  }


function isCellEmpty(index) {
    const cell = document.querySelector(`.cell[data-index='${index}']`);
    return !cell.querySelector(".unit");
}

function isCellEmptyForTank(index, tankId) {
    const cell = document.querySelector(`.cell[data-index='${index}']`);
    const unit = cell.querySelector(".unit");
    
    // Клетка пустая если в ней нет юнита или если юнит - это часть нашего танка
    return !unit || unit.dataset.tankId === tankId;
}

function canMove(fromIndex, toIndex) {
  const fromX = fromIndex % 20;
  const fromY = Math.floor(fromIndex / 20);
  const toX = toIndex % 20;
  const toY = Math.floor(toIndex / 20);

  const dx = Math.abs(fromX - toX);
  const dy = Math.abs(fromY - toY);

  return (dx + dy === 1); // только на 1 клетку по вертикали или горизонтали
}

function canMoveTank(fromIndex, toIndex) {
  const fromX = fromIndex % 20;
  const fromY = Math.floor(fromIndex / 20);
  const toX = toIndex % 20;
  const toY = Math.floor(toIndex / 20);

  const dx = Math.abs(fromX - toX);
  const dy = Math.abs(fromY - toY);

  // Танк может двигаться только на 1 клетку
  if (dx + dy !== 1) {
    return false;
  }

  // Проверяем, что танк не выйдет за границы (1x2 - вертикально)
  if (toX >= 19 || toY >= 19) {
    return false;
  }

  // Получаем ID текущего танка
  const fromUnit = document.querySelector(`.cell[data-index='${fromIndex}'] .unit`);
  const tankId = fromUnit.dataset.tankId;

  // Проверяем, что все 2 клетки назначения пустые или заняты частями того же танка (1x2 - вертикально)
  const targetIndices = [toIndex, toIndex + 20];
  for (let i of targetIndices) {
    if (!isCellEmptyForTank(i, tankId)) {
      return false;
    }
  }

  return true;
}

function moveTank(fromIndex, toIndex) {
  const fromUnit = document.querySelector(`.cell[data-index='${fromIndex}'] .unit`);
  const tankId = fromUnit.dataset.tankId;
  
  // Получаем все части танка (2 части для танка 2x1)
  const tankParts = document.querySelectorAll(`[data-tank-id="${tankId}"]`);
  
  // Вычисляем смещение
  const fromX = fromIndex % 20;
  const fromY = Math.floor(fromIndex / 20);
  const toX = toIndex % 20;
  const toY = Math.floor(toIndex / 20);
  
  const dx = toX - fromX;
  const dy = toY - fromY;
  
  // Перемещаем каждую часть танка
  tankParts.forEach(part => {
    const currentIndex = parseInt(part.dataset.tankIndex);
    const currentX = currentIndex % 20;
    const currentY = Math.floor(currentIndex / 20);
    
    const newX = currentX + dx;
    const newY = currentY + dy;
    const newIndex = newY * 20 + newX;
    
    // Обновляем данные части
    part.dataset.tankIndex = newIndex;
    
    // Перемещаем в новую клетку
    const newCell = document.querySelector(`.cell[data-index='${newIndex}']`);
    newCell.appendChild(part);
  });
}

function canPlaceTank(index) {
  const x = index % 20;
  const y = Math.floor(index / 20);

  // Проверка: танк не выходит за границы (1x2 - вертикально)
  if (x >= 19 || y >= 19) return false;

  // Индексы всех 2 клеток танка (1x2 - вертикально)
  const indices = [
    index,
    index + 20
  ];

  // Проверка: все клетки пустые
  for (let i of indices) {
    if (!isCellEmpty(i)) return false;
  }

  return true;
}

function placeTank(index) {
  // Проверяем, можно ли разместить танк
  if (!canPlaceTank(index)) {
    return false;
  }

  const x = index % 20;
  const y = Math.floor(index / 20);

  // Индексы всех 2 клеток танка (1x2 - вертикально)
  const indices = [
    index,
    index + 20
  ];

  // Создаем уникальный ID для танка
  const tankId = `tank-${Date.now()}-${Math.random()}`;

  // Размещение танка
  for (let i of indices) {
    const cell = document.querySelector(`.cell[data-index='${i}']`);
    const part = document.createElement("div");
    part.classList.add("unit", "tank");
    part.dataset.tankId = tankId;
    part.dataset.tankIndex = i;
    cell.appendChild(part);
  }

  return true;
}
