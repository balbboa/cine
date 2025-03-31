import { test, expect, Page } from '@playwright/test';

// Helper function to dump the HTML of important elements for debugging
async function logPageStructure(page: Page, message: string) {
  console.log(`\n------- ${message} -------`);
  const html = await page.content();
  // Log a shortened version of the HTML to avoid flooding the console
  console.log(html.substring(0, 1000) + '... (truncated)');
  console.log('-----------------------------------\n');
}

// Helper function to take screenshots at key points
async function takeDebugScreenshot(page: Page, name: string) {
  const screenshotPath = `./test-debug-${name}-${new Date().toISOString().replace(/:/g, '-')}.png`;
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`Screenshot saved to ${screenshotPath}`);
}

test.describe('Cine-Tac-Toe Game Tests', () => {
  // This test verifies the basic gameplay flow
  test('should allow a player to enter a movie and make a move', async ({ page }) => {
    // Setup: Launch the application
    await page.goto('/'); // Adjust URL if needed
    
    // Wait for the game to load
    await page.waitForSelector('h1:has-text("Cine-Tac-Toe")', { timeout: 5000 })
      .catch(error => {
        console.error('Game title not found, page may not have loaded correctly:', error);
        throw new Error('Game failed to load properly');
      });
    
    // Step 1: Start a new game (if there's a start button)
    const startButtonSelectors = [
      'button:has-text("Start Game")', 
      'button:has-text("New Game")',
      'button:has-text("Play")'
    ];
    
    for (const selector of startButtonSelectors) {
      const startButton = page.locator(selector);
      if (await startButton.count() > 0) {
        await startButton.click();
        console.log(`Clicked on start button with selector: ${selector}`);
        // Take screenshot after clicking start
        await takeDebugScreenshot(page, 'after-start-click');
        await logPageStructure(page, 'Page Structure After Start Button Click');
        break;
      }
    }
    
    // Wait a moment for any animations or transitions to complete
    await page.waitForTimeout(1000);
    // Step 2: Enter a movie title in the input field
    try {
      // Log structure before looking for input field
      await logPageStructure(page, 'Before Finding Movie Input');
      await takeDebugScreenshot(page, 'before-movie-input');
      
      // Define multiple possible selectors for the movie input field
      const movieInputSelectors = [
        'input[placeholder*="movie" i]',
        'input[placeholder*="film" i]',
        'input[placeholder*="title" i]',
        'input[type="text"]',
        'input.movie-input',
        '[data-testid*="movie-input"]',
        '[aria-label*="movie" i]',
        'form input'
      ];
      
      // Try each selector until we find a valid input
      let movieInputFound = false;
      let usedSelector = '';
      
      for (const selector of movieInputSelectors) {
        const input = page.locator(selector);
        const count = await input.count();
        console.log(`Checking movie input selector: ${selector} - Found: ${count}`);
        
        if (count > 0) {
          // Attempt to focus on the input
          await input.focus();
          
          // Clear any existing text
          await input.clear();
          
          // Type a movie title
          await input.fill('The Matrix');
          console.log(`Entered movie title "The Matrix" using selector: ${selector}`);
          movieInputFound = true;
          usedSelector = selector;
          break;
        }
      }
      
      if (!movieInputFound) {
        console.error('Could not find movie input field with any of the attempted selectors');
        await takeDebugScreenshot(page, 'movie-input-not-found');
        throw new Error('Movie input field not found');
      }
      
      // Take screenshot after entering the movie
      await takeDebugScreenshot(page, 'after-movie-input');
      // Submit the movie title (press Enter or click a submit button)
      // Try to submit using the Enter key first
      try {
        await page.press(usedSelector, 'Enter');
        console.log('Pressed Enter key to submit movie title');
      } catch (e) {
        console.log('Could not press Enter on the input field:', e);
      }
      
      // Look for various submit buttons
      const submitButtonSelectors = [
        'button:has-text("Submit")',
        'button:has-text("Add")',
        'button:has-text("Enter")',
        'button:has-text("OK")',
        'button:has-text("Confirm")',
        'button[type="submit"]',
        'form button',
        '.submit-button'
      ];
      
      let submitClicked = false;
      for (const selector of submitButtonSelectors) {
        const submitButton = page.locator(selector);
        const count = await submitButton.count();
        console.log(`Checking submit button selector: ${selector} - Found: ${count}`);
        
        if (count > 0) {
          await submitButton.click();
          console.log(`Clicked submit button with selector: ${selector}`);
          submitClicked = true;
          break;
        }
      }
      
      // Take screenshot after submission
      await takeDebugScreenshot(page, 'after-movie-submission');
      await logPageStructure(page, 'After Movie Submission');
      console.error('Failed to enter movie title:', error);
      throw new Error('Could not enter movie title');
    }
    
    // Step 3: Make a move on the board
    try {
      // Wait for the board to be ready for moves
      await page.waitForSelector('.board-cell, .game-cell, [data-testid="board-cell"]', { timeout: 5000 })
        .catch(async (error) => {
          console.error('Board cells not found with standard selectors:', error);
          await takeDebugScreenshot(page, 'board-not-found');
          await logPageStructure(page, 'When Board Not Found');
          
          // Try to identify any potential board elements
          const potentialBoardElements = await page.$$('div > div > div');
          console.log(`Found ${potentialBoardElements.length} potential board container elements`);
        });
        
      // Take screenshot of the board
      await takeDebugScreenshot(page, 'board-before-move');
      await logPageStructure(page, 'Board Before Move');
      
      // Click on the first available cell (index 0,0 - top left)
      // Using multiple possible selectors to increase robustness
      const cellSelectors = [
        '.board-cell:first-child',
        '.game-cell:first-child',
        '[data-testid="board-cell-0-0"]',
        '[data-cell-index="0"]',
        '.board div:first-child',
        '.tic-tac-toe-grid > div:first-child',
        '.grid-cell:first-child',
        'table tr:first-child td:first-child'
      ];
      let moveSuccessful = false;
      for (const selector of cellSelectors) {
        const cell = page.locator(selector);
        if (await cell.count() > 0) {
          await cell.click();
          console.log(`Clicked on cell with selector: ${selector}`);
          await takeDebugScreenshot(page, 'after-cell-click');
          moveSuccessful = true;
          break;
        }
      }
      
      // If we couldn't find a cell with our predefined selectors, try a more aggressive approach
      if (!moveSuccessful) {
        console.log('Could not find board cell with standard selectors, trying to find clickable elements');
        
        // Try to find any element that looks like it could be a cell
        const allDivs = await page.$$('div');
        console.log(`Found ${allDivs.length} div elements on the page`);
        
        // Take a screenshot of the current state
        await takeDebugScreenshot(page, 'board-cells-not-found');
      if (!moveSuccessful) {
        throw new Error('Could not find a valid board cell to click');
      }
    } catch (error) {
      console.error('Failed to make a move on the board:', error);
      throw new Error('Could not make a move on the board');
    }
    
    // Step 4: Verify the board state after the move
    try {
      // Check if the cell contains the player's marker (X or O)
      // This assumes the first player is X, adjust if needed
      const markedCell = page.locator('.board-cell:has-text("X"), .game-cell:has-text("X"), [data-testid="board-cell"]:has-text("X")');
      
      // Verify the move was registered
      await expect(markedCell).toBeVisible({ timeout: 2000 });
      console.log('Successfully verified that the move was registered on the board');
      
      // Additional verification: Check if it's now the opponent's turn
      const turnIndicator = page.locator('text=Player O turn, text=Opponent turn, text=Your opponent');
      if (await turnIndicator.count() > 0) {
        await expect(turnIndicator).toBeVisible();
        console.log('Successfully verified that it is now the opponent\'s turn');
      }
    } catch (error) {
      console.error('Failed to verify the board state:', error);
      throw new Error('Could not verify the board state after making a move');
    }
  });
  
  // This test verifies error handling when entering invalid movie titles
  test('should show error message for invalid movie title', async ({ page }) => {
    // Implementation of this test would be similar to the previous one
    // but with invalid input to test error handling
    // This is a placeholder for future implementation
    await page.goto('/');
    
    // Take initial screenshot
    await takeDebugScreenshot(page, 'invalid-test-initial');
    
    // Basic assertions to ensure the page loaded
    await expect(page).toHaveTitle(/Cine-Tac-Toe|Tic-Tac-Toe/);
    
    // Log page structure to help with debugging
    await logPageStructure(page, 'Invalid Test Initial Structure');
    // This test would continue with entering an invalid movie and checking
    // for appropriate error messages
  });
});

