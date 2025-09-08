// Sudoku Game Logic
let currentGrid = [];
let solution = [];
let startTime;
let timerInterval;
let currentDifficulty = 'easy';

const difficulties = {
    easy: 45,
    medium: 35,
    hard: 25,
    expert: 17
};

function createEmptyGrid() {
    return Array(9).fill().map(() => Array(9).fill(0));
}

function isValid(grid, row, col, num) {
    // Check row
    for (let x = 0; x < 9; x++) {
        if (grid[row][x] === num) return false;
    }

    // Check column
    for (let x = 0; x < 9; x++) {
        if (grid[x][col] === num) return false;
    }

    // Check 3x3 box
    const startRow = Math.floor(row / 3) * 3;
    const startCol = Math.floor(col / 3) * 3;
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            if (grid[startRow + i][startCol + j] === num) return false;
        }
    }

    return true;
}

function solveSudoku(grid) {
    for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9; col++) {
            if (grid[row][col] === 0) {
                for (let num = 1; num <= 9; num++) {
                    if (isValid(grid, row, col, num)) {
                        grid[row][col] = num;
                        if (solveSudoku(grid)) return true;
                        grid[row][col] = 0;
                    }
                }
                return false;
            }
        }
    }
    return true;
}

function generateSudoku() {
    const grid = createEmptyGrid();
    
    // Fill diagonal 3x3 boxes first
    for (let i = 0; i < 9; i += 3) {
        fillBox(grid, i, i);
    }
    
    // Solve the rest
    solveSudoku(grid);
    
    return grid;
}

function fillBox(grid, row, col) {
    const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            const randomIndex = Math.floor(Math.random() * nums.length);
            grid[row + i][col + j] = nums[randomIndex];
            nums.splice(randomIndex, 1);
        }
    }
}

function createPuzzle(difficulty) {
    const completeGrid = generateSudoku();
    solution = completeGrid.map(row => [...row]);
    
    const puzzle = completeGrid.map(row => [...row]);
    const cellsToRemove = 81 - difficulties[difficulty];
    
    for (let i = 0; i < cellsToRemove; i++) {
        let row, col;
        do {
            row = Math.floor(Math.random() * 9);
            col = Math.floor(Math.random() * 9);
        } while (puzzle[row][col] === 0);
        
        puzzle[row][col] = 0;
    }
    
    return puzzle;
}

function renderGrid() {
    const gridElement = document.getElementById('sudoku-grid');
    gridElement.innerHTML = '';
    
    for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9; col++) {
            const cell = document.createElement('input');
            cell.type = 'text';
            cell.className = 'sudoku-cell';
            cell.maxLength = 1;
            
            if (currentGrid[row][col] !== 0) {
                cell.value = currentGrid[row][col];
                cell.classList.add('given');
                cell.readOnly = true;
            }
            
            cell.addEventListener('input', function(e) {
                const value = parseInt(e.target.value);
                if (isNaN(value) || value < 1 || value > 9) {
                    e.target.value = '';
                    return;
                }
                
                const cellIndex = Array.from(gridElement.children).indexOf(e.target);
                const cellRow = Math.floor(cellIndex / 9);
                const cellCol = cellIndex % 9;
                
                // Check for conflicts
                const isValidMove = isValid(currentGrid, cellRow, cellCol, value);
                e.target.classList.toggle('conflict', !isValidMove);
                
                checkWin();
            });
            
            gridElement.appendChild(cell);
        }
    }
}

function checkWin() {
    const cells = document.querySelectorAll('.sudoku-cell');
    const grid = [];
    let hasConflicts = false;
    
    // Build current grid state
    for (let i = 0; i < 9; i++) {
        grid[i] = [];
        for (let j = 0; j < 9; j++) {
            const cellValue = cells[i * 9 + j].value;
            grid[i][j] = cellValue ? parseInt(cellValue) : 0;
            
            // Check if any cells have conflicts
            if (cells[i * 9 + j].classList.contains('conflict')) {
                hasConflicts = true;
            }
        }
    }
    
    // Don't check for win if there are conflicts
    if (hasConflicts) {
        return;
    }
    
    // Check if puzzle is complete
    let isComplete = true;
    for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9; col++) {
            if (grid[row][col] === 0) {
                isComplete = false;
                break;
            }
        }
        if (!isComplete) break;
    }
    
    // If complete, verify it matches the solution
    if (isComplete) {
        let isCorrect = true;
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                if (grid[row][col] !== solution[row][col]) {
                    isCorrect = false;
                    break;
                }
            }
            if (!isCorrect) break;
        }
        
        if (isCorrect) {
            // Puzzle completed successfully!
            clearInterval(timerInterval);
            
            // Add celebration animation
            const completionMsg = document.getElementById('completion-message');
            completionMsg.style.display = 'block';
            completionMsg.style.animation = 'pulse 2s infinite';
            
            // Add confetti effect to all cells
            cells.forEach(cell => {
                if (!cell.classList.contains('given')) {
                    cell.style.background = 'linear-gradient(45deg, #4CAF50, #81C784)';
                    cell.style.color = 'white';
                    cell.style.animation = 'celebrationPulse 1s ease-in-out';
                }
            });
            
            // Play celebration sound (if audio is available)
            try {
                const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+b9xWgdBiaN2+/DCSQHIX/E9N+VQgoVX7bk6qpZFwoMnrPj+MlhGAQfidb3w3gkBSl+zO/EGSUEInTE8d2QQAsTXLPq6atWFAoNn7Ps+8kkBSN8yOzfJSUIHw==');
                audio.play();
            } catch (e) {
                // Audio not available, continue without sound
            }
            
            // Save best time if it's a new record
            const currentTime = document.getElementById('timer').textContent;
            const bestTimeKey = `sudoku-best-${currentDifficulty}`;
            const currentBest = localStorage.getItem(bestTimeKey);
            
            if (!currentBest || timeToSeconds(currentTime) < timeToSeconds(currentBest)) {
                localStorage.setItem(bestTimeKey, currentTime);
                completionMsg.innerHTML += '<br><small>🏆 New Best Time!</small>';
            }
        }
    }
}

function timeToSeconds(timeString) {
    const [minutes, seconds] = timeString.split(':').map(Number);
    return minutes * 60 + seconds;
}

function getHint() {
    const cells = document.querySelectorAll('.sudoku-cell:not(.given)');
    const emptyCells = Array.from(cells).filter(cell => !cell.value);
    
    if (emptyCells.length === 0) return;
    
    const randomCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    const cellIndex = Array.from(document.querySelectorAll('.sudoku-cell')).indexOf(randomCell);
    const row = Math.floor(cellIndex / 9);
    const col = cellIndex % 9;
    
    randomCell.value = solution[row][col];
    randomCell.classList.add('hint');
    randomCell.readOnly = true;
    
    checkWin();
}

function startTimer() {
    startTime = Date.now();
    timerInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const minutes = Math.floor(elapsed / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        document.getElementById('timer').textContent = 
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }, 1000);
}

function newGame() {
    const difficulty = document.getElementById('difficulty').value;
    currentDifficulty = difficulty;
    document.getElementById('current-difficulty').textContent = 
        difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
    
    currentGrid = createPuzzle(difficulty);
    document.getElementById('completion-message').style.display = 'none';
    
    clearInterval(timerInterval);
    renderGrid();
    startTimer();
}

// Initialize game
document.addEventListener('DOMContentLoaded', function() {
    newGame();
});
