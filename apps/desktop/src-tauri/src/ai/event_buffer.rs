use std::collections::VecDeque;

const DEFAULT_CAPACITY: usize = 200;

/// Circular event buffer that stores serialized events with sequence numbers.
/// Enables replay of missed events on reconnect.
#[derive(Debug)]
#[allow(dead_code)]
pub struct EventBuffer {
    buffer: VecDeque<BufferedEvent>,
    capacity: usize,
    next_seq: u32,
}

#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct BufferedEvent {
    pub seq: u32,
    pub data: String, // JSON-serialized AdapterEvent
}

#[allow(dead_code)]
impl EventBuffer {
    pub fn new() -> Self {
        Self {
            buffer: VecDeque::with_capacity(DEFAULT_CAPACITY),
            capacity: DEFAULT_CAPACITY,
            next_seq: 1,
        }
    }

    pub fn with_capacity(capacity: usize) -> Self {
        Self {
            buffer: VecDeque::with_capacity(capacity),
            capacity,
            next_seq: 1,
        }
    }

    /// Push an event into the buffer. Returns the assigned sequence number.
    pub fn push(&mut self, data: String) -> u32 {
        let seq = self.next_seq;
        self.next_seq += 1;

        if self.buffer.len() >= self.capacity {
            self.buffer.pop_front();
        }

        self.buffer.push_back(BufferedEvent { seq, data });
        seq
    }

    /// Get the current sequence number (next to be assigned).
    pub fn current_seq(&self) -> u32 {
        self.next_seq
    }

    /// Replay events since a given sequence number (exclusive).
    /// Returns events with seq > since_seq.
    pub fn replay_since(&self, since_seq: u32) -> Vec<&BufferedEvent> {
        self.buffer.iter().filter(|e| e.seq > since_seq).collect()
    }

    /// Get the most recent N events.
    pub fn recent(&self, count: usize) -> Vec<&BufferedEvent> {
        let skip = self.buffer.len().saturating_sub(count);
        self.buffer.iter().skip(skip).collect()
    }

    /// Clear the buffer.
    pub fn clear(&mut self) {
        self.buffer.clear();
    }

    /// Number of events in the buffer.
    pub fn len(&self) -> usize {
        self.buffer.len()
    }

    pub fn is_empty(&self) -> bool {
        self.buffer.is_empty()
    }
}

impl Default for EventBuffer {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_push_returns_sequential_ids() {
        let mut buf = EventBuffer::new();
        assert_eq!(buf.push("event1".into()), 1);
        assert_eq!(buf.push("event2".into()), 2);
        assert_eq!(buf.push("event3".into()), 3);
    }

    #[test]
    fn test_current_seq_advances() {
        let mut buf = EventBuffer::new();
        assert_eq!(buf.current_seq(), 1);
        buf.push("a".into());
        assert_eq!(buf.current_seq(), 2);
    }

    #[test]
    fn test_len_and_is_empty() {
        let mut buf = EventBuffer::new();
        assert!(buf.is_empty());
        assert_eq!(buf.len(), 0);
        buf.push("a".into());
        assert!(!buf.is_empty());
        assert_eq!(buf.len(), 1);
    }

    #[test]
    fn test_capacity_eviction() {
        let mut buf = EventBuffer::with_capacity(3);
        buf.push("a".into());
        buf.push("b".into());
        buf.push("c".into());
        assert_eq!(buf.len(), 3);

        buf.push("d".into()); // should evict "a"
        assert_eq!(buf.len(), 3);

        let all = buf.replay_since(0);
        assert_eq!(all.len(), 3);
        assert_eq!(all[0].data, "b");
        assert_eq!(all[1].data, "c");
        assert_eq!(all[2].data, "d");
    }

    #[test]
    fn test_replay_since() {
        let mut buf = EventBuffer::new();
        buf.push("a".into()); // seq 1
        buf.push("b".into()); // seq 2
        buf.push("c".into()); // seq 3

        let since_2 = buf.replay_since(2);
        assert_eq!(since_2.len(), 1);
        assert_eq!(since_2[0].seq, 3);
        assert_eq!(since_2[0].data, "c");

        let since_0 = buf.replay_since(0);
        assert_eq!(since_0.len(), 3);

        let since_3 = buf.replay_since(3);
        assert_eq!(since_3.len(), 0);
    }

    #[test]
    fn test_recent() {
        let mut buf = EventBuffer::new();
        buf.push("a".into());
        buf.push("b".into());
        buf.push("c".into());
        buf.push("d".into());

        let last_2 = buf.recent(2);
        assert_eq!(last_2.len(), 2);
        assert_eq!(last_2[0].data, "c");
        assert_eq!(last_2[1].data, "d");

        let last_10 = buf.recent(10);
        assert_eq!(last_10.len(), 4); // only 4 available
    }

    #[test]
    fn test_clear() {
        let mut buf = EventBuffer::new();
        buf.push("a".into());
        buf.push("b".into());
        buf.clear();
        assert!(buf.is_empty());
        assert_eq!(buf.len(), 0);
        // Seq continues from where it left off
        assert_eq!(buf.push("c".into()), 3);
    }
}
