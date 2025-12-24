/**
 * Utility function to clean up temporary profile IDs from communicator
 * 
 * Usage in browser console:
 *   window.cleanupTemporaryProfiles(['cPRXq7diu', '8hoYveCXh', '5fwvvF6im', 'QYNenl2aR', 'JakXq9_gw'])
 * 
 * Or clean up all temporary IDs:
 *   window.cleanupTemporaryProfiles()
 */

import { deleteBoardCommunicator } from '../components/Communicator/Communicator.actions';
import { deleteBoard } from '../components/Board/Board.actions';

/**
 * Helper function to check if an ID is a shortid (temporary ID)
 */
const isShortId = (id) => {
  const idStr = String(id || '');
  // shortid typically contains letters and is 9-11 characters long
  // Numeric IDs are permanent database IDs
  return idStr.length > 0 && !/^\d+$/.test(idStr);
};

/**
 * Clean up temporary profile IDs from communicator and Redux store
 * @param {string[]} tempIds - Array of temporary IDs to clean up. If not provided, cleans all temporary IDs
 */
export function cleanupTemporaryProfiles(tempIds = null) {
  if (typeof window === 'undefined' || !window.__REDUX_STORE__) {
    console.error('Redux store not available. Make sure you are in development mode.');
    return;
  }

  const store = window.__REDUX_STORE__;
  const state = store.getState();
  const { communicator, board } = state;

  // Get current active communicator
  const activeCommunicatorId = communicator.activeCommunicatorId;
  const currentCommunicator = communicator.communicators.find(
    c => c.id === activeCommunicatorId
  );

  if (!currentCommunicator) {
    console.error('No active communicator found');
    return;
  }

  console.log('=== CLEANING UP TEMPORARY PROFILES ===');
  console.log('Active Communicator:', currentCommunicator.id);
  console.log('Current boards in communicator:', currentCommunicator.boards);

  // Determine which IDs to clean up
  let idsToClean = [];
  
  if (tempIds && Array.isArray(tempIds)) {
    // Clean up specific IDs provided by user
    idsToClean = tempIds.map(id => String(id));
    console.log('Cleaning up specific IDs:', idsToClean);
  } else {
    // Clean up all temporary IDs (shortid format) from communicator
    if (currentCommunicator.boards && Array.isArray(currentCommunicator.boards)) {
      idsToClean = currentCommunicator.boards
        .map(id => String(id || ''))
        .filter(id => id && isShortId(id));
      console.log('Found temporary IDs to clean up:', idsToClean);
    }
  }

  if (idsToClean.length === 0) {
    console.log('No temporary IDs found to clean up');
    return;
  }

  // Remove from communicator
  let cleanedCount = 0;
  idsToClean.forEach(id => {
    try {
      store.dispatch(deleteBoardCommunicator(id));
      console.log(`✓ Removed ${id} from communicator`);
      cleanedCount++;
    } catch (err) {
      console.error(`✗ Failed to remove ${id} from communicator:`, err);
    }
  });

  // Also remove from Redux boards store if they exist
  const boards = board.boards || [];
  idsToClean.forEach(id => {
    const boardInRedux = boards.find(b => String(b.id) === id);
    if (boardInRedux) {
      try {
        store.dispatch(deleteBoard(id));
        console.log(`✓ Removed ${id} from Redux boards store`);
      } catch (err) {
        console.error(`✗ Failed to remove ${id} from Redux boards store:`, err);
      }
    }
  });

  // Get updated state
  const updatedState = store.getState();
  const updatedCommunicator = updatedState.communicator.communicators.find(
    c => c.id === activeCommunicatorId
  );

  console.log('\n=== CLEANUP COMPLETE ===');
  console.log(`Cleaned up ${cleanedCount} temporary profile(s)`);
  console.log('Remaining boards in communicator:', updatedCommunicator?.boards || []);
  console.log('\nTo save changes to backend, you may need to refresh the page or trigger a communicator update.');
}

// Make it available globally in development
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  window.cleanupTemporaryProfiles = cleanupTemporaryProfiles;
  
  // Also provide a helper to clean up the specific IDs mentioned by the user
  window.cleanupSpecificTemporaryProfiles = () => {
    cleanupTemporaryProfiles([
      'cPRXq7diu', // Time
      '8hoYveCXh', // People
      '5fwvvF6im', // Food
      'QYNenl2aR', // Emotions
      'JakXq9_gw'  // Activities
    ]);
  };
  
  console.log('Cleanup functions available:');
  console.log('  - window.cleanupTemporaryProfiles([id1, id2, ...]) - Clean up specific temporary IDs');
  console.log('  - window.cleanupTemporaryProfiles() - Clean up all temporary IDs');
  console.log('  - window.cleanupSpecificTemporaryProfiles() - Clean up the 5 specific temporary profiles');
}

