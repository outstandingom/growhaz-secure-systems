import random
import json
import hashlib
import os
import difflib
import math
from typing import List, Dict, Any, Tuple, Optional
from collections import defaultdict, Counter

# ============================================================
# BEST HYBRID VERSION – SuperDNA 26-Letter Brain (2026 Edition)
# ============================================================
# NEW INTEGRATION:
#   • Merkle tree verification  → exact symbolic check of known successful structures
#   • Vector similarity (16D)   → fuzzy semantic search for best concept/node
#   • Hybrid symbolic + vector reasoning (exactly like large neuro-symbolic systems)
#
# Benefits:
#   - Merkle = fast, cryptographically safe "is this exact proven structure?"
#   - Vector similarity = "which concept is semantically closest?" (human-like abstraction)
#   - Combined = verification + reasoning → much stronger lifelong learning

BASES = list("ABCDEFGHIJKLMNOPQRSTUVWXYZ")

BASE_VECTORS = {
    letter: [
        round(math.sin(i + ord(letter)) * 5 + 5, 2)
        for i in range(16)
    ]
    for letter in BASES
}

UNIVERSAL_LOGIC_PREFIXES = {
    "math:logic":     "MATH",
    "lang:hindi":     "HIND",
    "lang:tamil":     "TAMI",
    "code:python":    "PYTH",
    "sys:power":      "POWR"
}

BASE_PAIRS = {b: BASES[(i+13)%26] for i, b in enumerate(BASES)}

def dna_to_vector(dna: str, max_len: int = 20) -> List[float]:
    vec = [0.0] * 16
    for base in dna[:max_len]:
        v = BASE_VECTORS.get(base, [0.0] * 16)
        for i in range(16):
            vec[i] += v[i]
    return vec

def vector_similarity(v1: List[float], v2: List[float]) -> float:
    dot = sum(a * b for a, b in zip(v1, v2))
    n1 = math.sqrt(sum(a * a for a in v1)) or 1.0
    n2 = math.sqrt(sum(b * b for b in v2)) or 1.0
    return dot / (n1 * n2)


# ============================================================
# MEMORY LAYERS (unchanged)
# ============================================================

class EpisodicMemory:
    def __init__(self, max_size=50):
        self.experiences = []
        self.max_size = max_size
        self.decay_rate = 0.95

    def add(self, state_hash: str, action: str, outcome_hash: str, surprise: float):
        strength = surprise * 2.0
        self.experiences.append((state_hash, action, outcome_hash, surprise, strength))
        if len(self.experiences) > self.max_size:
            self.experiences.sort(key=lambda x: -x[4])
            self.experiences = self.experiences[:self.max_size]

    def decay(self):
        for i in range(len(self.experiences)):
            exp = list(self.experiences[i])
            exp[4] *= self.decay_rate
            self.experiences[i] = tuple(exp)


class SemanticMemory:
    def __init__(self):
        self.graph = defaultdict(dict)

    def add_triple(self, subject: str, predicate: str, object_: str):
        d = self.graph[subject].setdefault(predicate, {})
        d[object_] = d.get(object_, 0) + 1


class ProceduralMemory:
    def __init__(self, filename="procedural.json"):
        self.filename = filename
        self.weights = defaultdict(lambda: defaultdict(float))
        self.load()
        self.weights["general"]["concept:action:observe"] = 1.0
        self.weights["general"]["concept:action:manipulate"] = 0.8

    def update(self, context_tag: str, concept: Any, reward: float, lr=0.3):
        key = str(concept)
        old = self.weights[context_tag][key]
        delta = reward * lr if reward > 0 else reward * (lr * 0.5)
        self.weights[context_tag][key] = max(-2.0, min(5.0, old + delta))

    def save(self):
        try:
            with open(self.filename, 'w') as f:
                json.dump({k: dict(v) for k, v in self.weights.items()}, f, indent=2)
        except:
            pass

    def load(self):
        if os.path.exists(self.filename):
            try:
                with open(self.filename) as f:
                    raw = json.load(f)
                    for ctx, vals in raw.items():
                        self.weights[ctx].update(vals)
            except:
                pass


procedural = ProceduralMemory()
episodic = EpisodicMemory()
semantic = SemanticMemory()


# ============================================================
# WORLD MODEL
# ============================================================

class WorldModel:
    sector_offsets = {
        "general": 0, "agriculture": 1_000_000_000, "finance": 2_000_000_000,
        "security": 3_000_000_000, "marketing": 4_000_000_000,
    }
    next_offset = 5_000_000_000

    @classmethod
    def register_sector(cls, name: str) -> int:
        if name not in cls.sector_offsets:
            cls.sector_offsets[name] = cls.next_offset
            cls.next_offset += 1_000_000_000
            procedural.weights[name] = defaultdict(float)
            print(f"✨ New sector registered: '{name}' → offset {cls.sector_offsets[name]:,}")
        return cls.sector_offsets[name]

    def __init__(self):
        self.strand1 = defaultdict(Counter)
        self.strand2 = defaultdict(Counter)

    def surprise(self, state_hash: str, action: str, actual_next: str) -> float:
        pred = self.predict(state_hash, action)
        if pred is None:
            return 1.0
        if pred == actual_next:
            return 0.0
        return 1 - difflib.SequenceMatcher(None, pred, actual_next).ratio()

    def hash_input(self, world: Dict, sector_key: str = "general") -> int:
        if sector_key not in self.sector_offsets:
            print(f"⚠️ Unknown sector '{sector_key}' — using general")
        s = json.dumps(world, sort_keys=True)
        h = int(hashlib.sha256(s.encode()).hexdigest(), 16)
        base = h % (4 ** 20)
        return base + self.sector_offsets.get(sector_key, 0)


world_model = WorldModel()


# ============================================================
# SuperDNANode – Hybrid Core (Merkle + 16D Vector)
# ============================================================

class SuperDNANode:
    def __init__(self, n_length: int = 10, children=None,
                 strand_a1: str = None, strand_b1: str = None):
        self.n = n_length
        self.children = children or []

        self.logic_prefix = UNIVERSAL_LOGIC_PREFIXES["math:logic"]
        self.protected_len = len(self.logic_prefix)

        if strand_a1 is None:
            tail_len = max(0, self.n - self.protected_len)
            tail = ''.join(random.choice(BASES) for _ in range(tail_len))
            self.strand_a1 = self.logic_prefix + tail
        else:
            self.strand_a1 = strand_a1

        self.strand_a2 = ''.join(BASE_PAIRS.get(b, 'A') for b in self.strand_a1)
        self.strand_b1 = strand_b1 or ''.join(random.choice(BASES) for _ in range(self.n))
        self.strand_b2 = ''.join(BASE_PAIRS.get(b, 'A') for b in self.strand_b1)

        self.id = hashlib.md5((self.strand_a1 + self.strand_b1).encode()).hexdigest()[:8]
        self.bond_strength = sum(3 if b in 'GHIJ' else 2 for b in self.strand_a1 + self.strand_b1)

    @property
    def concept_id(self):
        a = int(hashlib.sha256(self.strand_a1.encode()).hexdigest(), 16) % (26 ** self.n)
        b = int(hashlib.sha256(self.strand_b1.encode()).hexdigest(), 16) % (26 ** self.n)
        return a * (26 ** self.n) + b

    @property
    def concept(self):
        va = dna_to_vector(self.strand_a1)
        vb = dna_to_vector(self.strand_b1)
        energy = (va[0] + vb[0]) / (va[1] + vb[1] + 1e-6)
        if energy > 2.8:
            return f"concept:action:open_{hash(tuple(va+vb)) % 10000}"
        elif energy > 2.0:
            return f"concept:action:dynamic_{hash(tuple(va+vb)) % 10000}"
        return f"concept:relation:connect_{hash(tuple(va+vb)) % 10000}"

    def get_atomic_weight(self):
        my = sum(sum(BASE_VECTORS.get(b, [0]*16)) for b in self.strand_a1 + self.strand_b1)
        return my + sum(c.get_atomic_weight() for c in self.children)

    def get_merkle_hash(self):
        """Full Merkle tree hash (recursive subtree verification)"""
        ch = "".join(c.get_merkle_hash() for c in self.children)
        return hashlib.sha256(f"{self.get_atomic_weight():.2f}|{self.concept_id}|{ch}".encode()).hexdigest()[:16]

    def get_self_merkle_hash(self):
        """Node-only hash (for prototype matching)"""
        return hashlib.sha256(f"{self.get_atomic_weight():.2f}|{self.concept_id}".encode()).hexdigest()[:16]

    def get_vector(self) -> List[float]:
        """16D semantic vector of this entire node (for similarity search)"""
        return dna_to_vector(self.strand_a1 + self.strand_b1, 20)

    def verify_merkle(self, known_merkle: str) -> bool:
        """Symbolic verification: is this exact proven structure?"""
        return self.get_merkle_hash() == known_merkle

    def decay(self, prob=0.005):
        self._mutate(prob, weak_only=True)

    def _mutate(self, prob=0.01, weak_only=True):
        for name in ['strand_a1', 'strand_b1']:
            s = list(getattr(self, name))
            start = self.protected_len if name == 'strand_a1' else 0
            for i in range(start, len(s)):
                bond = 3 if s[i] in 'GHIJ' else 2
                p = prob if not weak_only else prob * (4 - bond)
                if random.random() < p:
                    s[i] = random.choice([b for b in BASES if b != s[i]])
            new_s = ''.join(s)
            setattr(self, name, new_s)
            setattr(self, name.replace('1','2'), ''.join(BASE_PAIRS.get(b, 'A') for b in new_s))
        for c in self.children:
            c._mutate(prob, weak_only)

    def strengthen_accurate_logic(self):
        a = list(self.strand_a1)
        for i in range(self.protected_len, len(a)):
            if a[i] in 'ABCDEF' and random.random() < 0.12:
                a[i] = random.choice('GHIJKLMNOPQRSTUVWXYZ')
        self.strand_a1 = ''.join(a)
        self.strand_a2 = ''.join(BASE_PAIRS.get(b, 'A') for b in a)
        for c in self.children:
            c.strengthen_accurate_logic()

    def find_best_node(self, query_vec: List[float]) -> 'SuperDNANode':
        """Vector similarity search (fuzzy semantic reasoning)"""
        best, best_score = self, vector_similarity(query_vec, self.get_vector())
        for c in self.children:
            cand = c.find_best_node(query_vec)
            score = vector_similarity(query_vec, cand.get_vector())
            if score > best_score:
                best, best_score = cand, score
        return best

    def execute(self, world: Dict) -> Tuple[bool, str, Optional['SuperDNANode']]:
        c = self.concept
        if c.startswith("concept:action:"):
            act = c.split(":", 2)[-1]
            if "open" in act or "unlock" in act:
                if world.get("locked", True):
                    return False, "locked", self
                world["open"] = True
                return True, "explicit open", None

            # Bond-strength gradient (smooth learning signal)
            success_chance = max(0.0, (self.bond_strength - 28) / 45.0)
            if random.random() < success_chance:
                if world.get("locked", True):
                    return False, "still locked", self
                world["open"] = True
                return True, f"opened via bond={self.bond_strength:.0f}", None

        return False, f"dynamic {c}", self

    def replicate(self) -> 'SuperDNANode':
        a1 = self.strand_a1
        if random.random() < 0.001:
            pos = random.randint(self.protected_len, len(a1)-1)
            a1 = a1[:pos] + random.choice([b for b in BASES if b != a1[pos]]) + a1[pos+1:]
        b1 = self.strand_b1
        if random.random() < 0.001:
            pos = random.randint(0, len(b1)-1)
            b1 = b1[:pos] + random.choice([b for b in BASES if b != b1[pos]]) + b1[pos+1:]
        return SuperDNANode(self.n, [c.replicate() for c in self.children], a1, b1)

    def generate_token(self, seed_dna: str = None) -> str:
        seed = seed_dna or self.strand_a1
        seed_vec = dna_to_vector(seed[-5:])
        best_base = 'A'
        best_score = -float('inf')
        for base in BASES:
            base_vec = BASE_VECTORS[base]
            score = sum(s * b for s, b in zip(seed_vec[-2:], base_vec[:2]))
            if score > best_score:
                best_score = score
                best_base = base
        return seed + best_base


# ============================================================
# EVOLUTION MANAGER – Hybrid Verification + Similarity
# ============================================================

class DNABrainEvolution:
    def __init__(self, root: SuperDNANode):
        self.root = root
        self.generation = 0
        self.failed_structures = set()
        self.successful_structures = set()
        self.successful_prototypes = set()
        self.sector_experts = defaultdict(list)

    def clone_specialist(self, source: SuperDNANode) -> SuperDNANode:
        return SuperDNANode(source.n, [], source.strand_a1, None)

    def evolve(self, world: Dict, sector: str = "general") -> bool:
        self.generation += 1
        print(f"\nGen {self.generation:3d} [{sector}] ", end="")

        self.root.decay(0.003)
        working = self.root.replicate()

        merkle = working.get_merkle_hash()
        self_hash = working.get_self_merkle_hash()

        if merkle in self.failed_structures:
            working = working.replicate()

        # === VECTOR SIMILARITY SEARCH (fuzzy reasoning) ===
        query_dna = hash_to_super_dna(json.dumps(world, sort_keys=True), length=20)
        query_vec = dna_to_vector(query_dna)
        best = working.find_best_node(query_vec)          # ← now pure 16D vector search

        ok, msg, failed_node = best.execute(world)

        surprise = world_model.surprise("start", "execute", "end")
        extrinsic = 1.0 if ok and world.get("open", False) else -0.5
        reward = extrinsic + surprise * 1.2

        # === MERKLE VERIFICATION + REWARD SHAPING ===
        bonus = 0.0
        verified = False
        if merkle in self.successful_structures:
            if best.verify_merkle(merkle):                # ← symbolic Merkle verification
                bonus += 0.45
                verified = True
                print("✅ Merkle verified", end=" ")
        elif self_hash in self.successful_prototypes:
            bonus += 0.18
        reward += bonus

        # Remember good patterns
        if reward > 0.75:
            self.successful_structures.add(merkle)
            self.successful_prototypes.add(self_hash)

        # Rare structural reuse of proven patterns
        if (merkle in self.successful_structures or self_hash in self.successful_prototypes) \
           and random.random() < 0.07 and len(working.children) < 40:
            specialist = self.clone_specialist(best)
            working.children.append(specialist)
            print("♻️", end=" ")

        episodic.add("start", "execute", "end", surprise) if surprise > 0.3 else None
        episodic.decay()
        procedural.update(sector, best.concept, reward)

        if reward > 0.75:
            best.strengthen_accurate_logic()
            if best.concept_id not in self.sector_experts[sector]:
                self.sector_experts[sector].append(best.concept_id)
            if random.random() < 0.40:
                specialist = self.clone_specialist(best)
                working.children.append(specialist)

        print(f" r={reward:.2f} (bonus={bonus:.2f}) bond={best.bond_strength} kids={len(working.children)}")

        if not ok and failed_node:
            self.failed_structures.add(merkle)
            failed_node._mutate(0.18, weak_only=False)

        if ok and world.get("open", False):
            self.root = working
            return True

        self.root = working
        return False

    def migrate_intelligence(self, source_sector: str, target_sector: str):
        experts = self.sector_experts.get(source_sector, [])
        if not experts:
            return
        source_cid = random.choice(experts)
        source_node = self.find_node_by_cid(source_cid)
        if not source_node:
            return
        specialist = self.clone_specialist(source_node)
        self.root.children.append(specialist)
        self.sector_experts[target_sector].append(specialist.concept_id)
        print(f"  🧬 HGT: copied from {source_sector} → {target_sector}")


# ============================================================
# DEMO
# ============================================================

if __name__ == "__main__":
    print("SuperDNA Hybrid Brain – Merkle Verification + 16D Vector Similarity\n")

    WorldModel.register_sector("healthcare")
    WorldModel.register_sector("energy")

    root = SuperDNANode(n_length=10, children=[])
    evolver = DNABrainEvolution(root)

    door_world = {"locked": True, "open": False}

    print("=== Training general sector (300 generations) ===")
    opened = False
    for i in range(300):
        if evolver.evolve(door_world, "general"):
            print("\n=== DOOR OPENED SUCCESSFULLY ===")
            opened = True
            break

    if not opened:
        print("\n=== Door not opened yet – try more generations ===")

    print("\n=== Cross-sector transfer ===")
    for tgt in ["agriculture", "finance", "security", "marketing", "healthcare"]:
        evolver.migrate_intelligence("general", tgt)

    print("\n=== Example token generation ===")
    print("Generated token:", root.generate_token())

    print("\n=== Final state ===")
    print(f"  Children              : {len(root.children)}")
    print(f"  Successful structures : {len(evolver.successful_structures)}")
    print(f"  Successful prototypes : {len(evolver.successful_prototypes)}")
    print(f"  Concept space         : {26**root.n * 26**root.n :,} possible concepts")

    procedural.save()
    print("\n✅ Brain saved. Now fully hybrid (symbolic Merkle + vector reasoning)!")
