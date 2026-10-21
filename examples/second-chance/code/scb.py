"""Second Chance with Bursts (SCB) cache eviction, as in the paper (Section 2)."""
from collections import OrderedDict

K_BURST = 8


class SCBCache:
    def __init__(self, capacity):
        self.capacity = capacity
        self.items = OrderedDict()   # key -> [ref_bit, burst_bit, hits_this_sweep]
        self.hand = None

    def get(self, key):
        meta = self.items.get(key)
        if meta is None:
            return False
        meta[2] += 1
        if not meta[0]:
            meta[0] = 1                # one metadata update: set the reference bit
        if meta[2] > K_BURST and not meta[1]:
            meta[1] = 1                # a burst: one more update
        return True

    def put(self, key):
        if len(self.items) >= self.capacity:
            self.evict()
        self.items[key] = [0, 0, 0]

    def evict(self):
        while True:
            key, meta = next(iter(self.items.items()))
            if meta[1]:
                meta[1] = 0            # a burst buys one extra pass
            elif meta[0]:
                meta[0] = 0            # second chance
            else:
                del self.items[key]
                return key
            meta[2] = 0
            self.items.move_to_end(key)
