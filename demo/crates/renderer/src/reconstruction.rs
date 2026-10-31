use crate::{Bounds, Primitive};

#[derive(Default)]
pub struct Reconstruction {
    reveals: Vec<Reveal>,
    time: f64,
    batches: usize,
}

struct Reveal {
    start: f64,
    from: f32,
    to: f32,
}

impl Reveal {
    fn value(&self, now: f64) -> f32 {
        let t = ((now - self.start) / 300.0).clamp(0.0, 1.0) as f32;
        self.from + (self.to - self.from) * t * t * (3.0 - 2.0 * t)
    }
}

impl Reconstruction {
    pub fn check_time(&self, now: f64) -> Result<(), String> {
        if !now.is_finite() || now < self.time {
            return Err("Invalid reconstruction timestamp".into());
        }
        Ok(())
    }
    pub fn append(
        &mut self,
        parts: &[Primitive],
        bounds: Bounds,
        now: f64,
        animate: bool,
    ) -> Result<(), String> {
        self.check_time(now)?;
        self.time = now;
        let height = (bounds.max.y - bounds.min.y).max(f32::EPSILON);
        for part in parts {
            let start = if animate {
                let level = ((part.bounds.center().y - bounds.min.y) / height).clamp(0.0, 1.0);
                now + level as f64 * 1100.0 + self.batches.min(8) as f64 * 120.0
            } else {
                now - 300.0
            };
            let to = if part.visible { 1.0 } else { 0.0 };
            self.reveals.push(Reveal {
                start,
                from: 0.0,
                to,
            });
        }
        self.batches += 1;
        Ok(())
    }
    pub fn opacity(&self, index: usize) -> f32 {
        self.reveals[index].value(self.time)
    }
    pub fn rebase(&mut self, now: f64) -> Result<(), String> {
        self.check_time(now)?;
        let offset = now - self.time;
        for reveal in &mut self.reveals {
            reveal.start += offset;
        }
        self.time = now;
        Ok(())
    }
    pub fn fading_out(&self, index: usize) -> bool {
        self.reveals
            .get(index)
            .is_some_and(|reveal| reveal.to == 0.0 && reveal.value(self.time) > 0.0)
    }
    pub fn set_visibility(&mut self, parts: &[Primitive], now: Option<f64>) -> Result<(), String> {
        if parts.len() != self.reveals.len() {
            return Err("Visibility geometry does not match reconstruction".into());
        }
        let start = now.unwrap_or(self.time);
        self.check_time(start)?;
        let (low, high) = parts
            .iter()
            .zip(&self.reveals)
            .filter(|(part, reveal)| part.visible != (reveal.to == 1.0))
            .map(|(part, _)| part.bounds.center().y)
            .fold((f32::INFINITY, f32::NEG_INFINITY), |(low, high), y| {
                (low.min(y), high.max(y))
            });
        for (part, reveal) in parts.iter().zip(&mut self.reveals) {
            let to = if part.visible { 1.0 } else { 0.0 };
            if reveal.to == to {
                continue;
            }
            let from = reveal.value(self.time);
            let level = (part.bounds.center().y - low) / (high - low).max(f32::EPSILON);
            *reveal = Reveal {
                start: if now.is_some() {
                    start + level as f64 * 340.0
                } else {
                    start - 300.0
                },
                from,
                to,
            };
        }
        self.time = start;
        Ok(())
    }
    pub fn advance(&mut self, now: f64) -> Result<bool, String> {
        self.check_time(now)?;
        self.time = now;
        Ok(self
            .reveals
            .iter()
            .any(|reveal| reveal.from != reveal.to && now < reveal.start + 300.0))
    }
    pub fn finish(&mut self) {
        for reveal in &mut self.reveals {
            reveal.from = reveal.to;
            reveal.start = self.time - 300.0;
        }
    }
}
