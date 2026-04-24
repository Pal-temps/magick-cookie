use std::collections::VecDeque;
use std::hash::{DefaultHasher, Hash, Hasher};

const WINDOW_SIZE: usize = 50;

/// Rolling hash window for message deduplication.
/// Prevents duplicate messages on reconnect (pattern from Companion).
#[allow(dead_code)]
pub struct DedupState {
    recent_hashes: VecDeque<u64>,
}

#[allow(dead_code)]
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_first_message_is_not_duplicate() {
        let mut dedup = DedupState::new();
        assert!(!dedup.is_duplicate("hello"));
    }

    #[test]
    fn test_same_message_is_duplicate() {
        let mut dedup = DedupState::new();
        assert!(!dedup.is_duplicate("hello"));
        assert!(dedup.is_duplicate("hello"));
    }

    #[test]
    fn test_different_messages_are_not_duplicates() {
        let mut dedup = DedupState::new();
        assert!(!dedup.is_duplicate("hello"));
        assert!(!dedup.is_duplicate("world"));
    }

    #[test]
    fn test_window_eviction() {
        let mut dedup = DedupState::new();
        // Fill the window (WINDOW_SIZE = 50)
        for i in 0..WINDOW_SIZE {
            assert!(!dedup.is_duplicate(&format!("msg-{i}")));
        }
        // First message should have been evicted after adding one more
        assert!(!dedup.is_duplicate("overflow"));
        assert!(!dedup.is_duplicate("msg-0")); // evicted, so not a dup
    }

    #[test]
    fn test_clear_resets_state() {
        let mut dedup = DedupState::new();
        assert!(!dedup.is_duplicate("hello"));
        assert!(dedup.is_duplicate("hello"));
        dedup.clear();
        assert!(!dedup.is_duplicate("hello")); // no longer a dup after clear
    }

    #[test]
    fn test_is_duplicate_by_id() {
        let mut dedup = DedupState::new();
        assert!(!dedup.is_duplicate_by_id("uuid-1"));
        assert!(dedup.is_duplicate_by_id("uuid-1"));
        assert!(!dedup.is_duplicate_by_id("uuid-2"));
    }

    #[test]
    fn test_empty_string() {
        let mut dedup = DedupState::new();
        assert!(!dedup.is_duplicate(""));
        assert!(dedup.is_duplicate(""));
    }
}
