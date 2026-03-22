use std::collections::VecDeque;
use std::hash::{DefaultHasher, Hash, Hasher};

const WINDOW_SIZE: usize = 50;

/// Rolling hash window for message deduplication.
/// Prevents duplicate messages on reconnect (pattern from Companion).
pub struct DedupState {
    recent_hashes: VecDeque<u64>,
}

impl DedupState {
    pub fn new() -> Self {
        Self {
            recent_hashes: VecDeque::with_capacity(WINDOW_SIZE),
        }
    }

    /// Check if a message is a duplicate based on its content hash.
    /// Returns true if the message was already seen (duplicate).
    pub fn is_duplicate(&mut self, content: &str) -> bool {
        let hash = self.hash_content(content);

        if self.recent_hashes.contains(&hash) {
            return true;
        }

        // Add to window
        if self.recent_hashes.len() >= WINDOW_SIZE {
            self.recent_hashes.pop_front();
        }
        self.recent_hashes.push_back(hash);

        false
    }

    /// Check duplicate by UUID (for stream events that have unique IDs).
    /// Uses the UUID directly as the dedup key.
    pub fn is_duplicate_by_id(&mut self, id: &str) -> bool {
        self.is_duplicate(id)
    }

    /// Reset the dedup state (e.g. on new turn).
    pub fn clear(&mut self) {
        self.recent_hashes.clear();
    }

    fn hash_content(&self, content: &str) -> u64 {
        let mut hasher = DefaultHasher::new();
        content.hash(&mut hasher);
        hasher.finish()
    }
}

impl Default for DedupState {
    fn default() -> Self {
        Self::new()
    }
}
