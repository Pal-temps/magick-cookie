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
        self.buffer
            .iter()
            .filter(|e| e.seq > since_seq)
            .collect()
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
