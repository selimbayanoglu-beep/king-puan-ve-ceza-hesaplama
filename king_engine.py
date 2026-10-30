#!/usr/bin/env python3
"""King Puan ve Ceza Hesaplama Motoru (Python Bağımsız Kural ve Test Motoru).

Geleneksel Türk King Kuralları:
- 4 Oyuncu
- Toplam 20 El (4 oyuncu x 5 el)
- Her oyuncu 2 Koz ve 3 Ceza söylemek zorundadır (8 Koz + 12 Ceza = 20 El).
- Her ceza türü oyun boyunca en fazla 2 kez oynanabilir (6 ceza x 2 tekrar = 12 ceza).
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Dict, List, Optional


@dataclass
class GameDefinition:
    key: str
    title: str
    is_koz: bool
    total_units: int
    base_unit_point: int
    unit_name: str
    desc: str

    @property
    def total_hand_point(self) -> int:
        return self.total_units * self.base_unit_point


GAME_DEFS: Dict[str, GameDefinition] = {
    "koz": GameDefinition(
        key="koz",
        title="Koz Oyunu",
        is_koz=True,
        total_units=13,
        base_unit_point=50,
        unit_name="El",
        desc="Her el +50 puan kazandırır (Toplam +650 P).",
    ),
    "el_almaz": GameDefinition(
        key="el_almaz",
        title="El Almaz",
        is_koz=False,
        total_units=13,
        base_unit_point=-50,
        unit_name="El",
        desc="Her el -50 puan ceza verir (Toplam -650 P).",
    ),
    "kupa_almaz": GameDefinition(
        key="kupa_almaz",
        title="Kupa Almaz",
        is_koz=False,
        total_units=13,
        base_unit_point=-30,
        unit_name="Kupa",
        desc="Her kupa -30 puan ceza verir (Toplam -390 P).",
    ),
    "kiz_almaz": GameDefinition(
        key="kiz_almaz",
        title="Kız Almaz",
        is_koz=False,
        total_units=4,
        base_unit_point=-100,
        unit_name="Kız",
        desc="Her Kız -100 puan ceza verir (Toplam -400 P).",
    ),
    "erkek_almaz": GameDefinition(
        key="erkek_almaz",
        title="Erkek Almaz",
        is_koz=False,
        total_units=8,
        base_unit_point=-60,
        unit_name="Erkek (J & K)",
        desc="Her Vale/Papaz -60 puan ceza verir (Toplam -480 P).",
    ),
    "rifki": GameDefinition(
        key="rifki",
        title="Rıfkı (Kupa Papazı)",
        is_koz=False,
        total_units=1,
        base_unit_point=-320,
        unit_name="Kupa Papazı",
        desc="Kupa Papazı -320 puan ceza verir (Toplam -320 P).",
    ),
    "son_iki": GameDefinition(
        key="son_iki",
        title="Son İki El Almaz",
        is_koz=False,
        total_units=2,
        base_unit_point=-180,
        unit_name="El (12. ve 13.)",
        desc="Son iki elin her biri -180 puan ceza verir (Toplam -360 P).",
    ),
}


@dataclass
class HandResult:
    hand_no: int
    caller_idx: int
    game_key: str
    distribution: List[int]
    points: List[int]


class KingGame:
    def __init__(self, player_names: Optional[List[str]] = None, scoring_mode: str = "standard"):
        self.player_names = player_names or ["Oyuncu 1", "Oyuncu 2", "Oyuncu 3", "Oyuncu 4"]
        self.scoring_mode = scoring_mode  # standard, zero_sum, bloody
        self.rounds: List[HandResult] = []
        self.king_winner_idx: Optional[int] = None
        self.king_winner_tricks: Optional[int] = None

    def get_current_hand_number(self) -> int:
        return len(self.rounds) + 1

    def get_current_caller_index(self) -> int:
        return len(self.rounds) % 4

    def get_player_stats(self, p_idx: int) -> Dict[str, int]:
        koz_count = sum(1 for r in self.rounds if r.caller_idx == p_idx and GAME_DEFS[r.game_key].is_koz)
        ceza_count = sum(1 for r in self.rounds if r.caller_idx == p_idx and not GAME_DEFS[r.game_key].is_koz)
        total_score = sum(r.points[p_idx] for r in self.rounds)
        return {
            "koz_count": koz_count,
            "ceza_count": ceza_count,
            "total_score": total_score,
            "remaining_koz": 2 - koz_count,
            "remaining_ceza": 3 - ceza_count,
        }

    def can_call_game(self, p_idx: int, game_key: str) -> bool:
        if game_key not in GAME_DEFS:
            return False
        def_ = GAME_DEFS[game_key]
        stats = self.get_player_stats(p_idx)

        if def_.is_koz:
            return stats["remaining_koz"] > 0

        # Ceza kontrolü
        if stats["remaining_ceza"] <= 0:
            return False

        # Oyun genelinde bu ceza 2 kez oynandı mı?
        global_played = sum(1 for r in self.rounds if r.game_key == game_key)
        if global_played >= 2:
            return False

        return True

    def record_hand(self, game_key: str, distribution: List[int]) -> HandResult:
        hand_no = self.get_current_hand_number()
        if hand_no > 20:
            raise ValueError("Oyun tamamlandı (20 el bitti)!")

        caller_idx = self.get_current_caller_index()
        if not self.can_call_game(caller_idx, game_key):
            raise ValueError(f"{self.player_names[caller_idx]} için '{game_key}' oyunu kural gereği seçilemez!")

        def_ = GAME_DEFS[game_key]
        if len(distribution) != 4 or sum(distribution) != def_.total_units:
            raise ValueError(
                f"Geçersiz dağılım: Toplam {def_.total_units} {def_.unit_name} olmalı! (Girilen: {sum(distribution)})"
            )

        unit_pts = def_.base_unit_point
        if self.scoring_mode == "zero_sum" and not def_.is_koz:
            unit_pts *= 2

        points = []
        for i, count in enumerate(distribution):
            p = count * unit_pts
            if self.scoring_mode == "bloody" and not def_.is_koz and i == caller_idx and p < 0:
                p *= 2
            points.append(p)

        res = HandResult(
            hand_no=hand_no,
            caller_idx=caller_idx,
            game_key=game_key,
            distribution=distribution,
            points=points,
        )
        self.rounds.append(res)
        if def_.is_koz and distribution[caller_idx] >= 11:
            self.king_winner_idx = caller_idx
            self.king_winner_tricks = distribution[caller_idx]
        return res

    def declare_king_win(self, tricks: int = 11) -> HandResult:
        """Sıradaki oyuncu KING der ve 11+ el alırsa ceza ve koz durumu ne olursa olsun oyunu kazanır."""
        if tricks < 11 or tricks > 13:
            raise ValueError("KING kazanmak için en az 11 el (11, 12 veya 13) alınmalıdır!")
        hand_no = self.get_current_hand_number()
        caller_idx = self.get_current_caller_index()
        dist = [0, 0, 0, 0]
        dist[caller_idx] = tricks
        rem = 13 - tricks
        if rem > 0:
            dist[(caller_idx + 1) % 4] = rem
        pts = [c * 50 for c in dist]
        res = HandResult(
            hand_no=hand_no,
            caller_idx=caller_idx,
            game_key="koz",
            distribution=dist,
            points=pts,
        )
        self.rounds.append(res)
        self.king_winner_idx = caller_idx
        self.king_winner_tricks = tricks
        return res

    def get_leaderboard(self) -> List[Dict[str, any]]:
        board = []
        for i, name in enumerate(self.player_names):
            st = self.get_player_stats(i)
            board.append({
                "rank": 0,
                "player_id": i,
                "name": name,
                "score": st["total_score"],
                "koz": f"{st['koz_count']}/2",
                "ceza": f"{st['ceza_count']}/3",
            })
        board.sort(key=lambda x: x["score"], reverse=True)
        for rank, item in enumerate(board, start=1):
            item["rank"] = rank
        return board


def run_unit_tests() -> None:
    print("🧪 King Kural & Skor Motoru Testleri Çalıştırılıyor...")

    # Test 1: Sabit Ceza Puanları Toplamı
    ceza_total = sum(g.total_hand_point for g in GAME_DEFS.values() if not g.is_koz)
    assert ceza_total == -2600, f"Ceza toplamı -2600 olmalı, hesaplanan: {ceza_total}"
    print(f"  ✓ 6 Ceza Oyununun Toplam Puanı Doğrulandı: {ceza_total} P")

    # Test 2: 12 Ceza Eli Toplamı
    ceza_12_el_total = ceza_total * 2
    assert ceza_12_el_total == -5200, f"12 Ceza toplamı -5200 olmalı, hesaplanan: {ceza_12_el_total}"
    print(f"  ✓ 12 Ceza Eli Toplam Ceza Havuzu: {ceza_12_el_total} P")

    # Test 3: 8 Koz Eli Toplamı
    koz_8_el_total = 8 * (13 * 50)
    assert koz_8_el_total == 5200, f"8 Koz toplamı +5200 olmalı, hesaplanan: {koz_8_el_total}"
    print(f"  ✓ 8 Koz Eli Toplam Kazanç Havuzu: +{koz_8_el_total} P")

    # Test 4: Sıfır Toplamlı Dengesi (Zero-Sum Balance)
    assert koz_8_el_total + ceza_12_el_total == 0, "Koz ve Ceza havuzu sıfır toplamlı modda birbirini tam sıfırlamalı!"
    print("  ✓ Sıfır Toplamlı Denge Doğrulandı: Koz (+5200) + Ceza (-5200) = 0 Puan")

    # Test 5: Oyun Akışı ve Validasyon Testi
    game = KingGame()
    # 1. el: Oyuncu 1 koz söylesin
    r1 = game.record_hand("koz", [5, 4, 2, 2])
    assert r1.points == [250, 200, 100, 100]
    assert game.get_player_stats(0)["koz_count"] == 1
    print("  ✓ Koz eli dağılım ve puanlama testi başarılı.")

    # 2. el: Oyuncu 2 Rıfkı söylesin (Kupa papazı)
    r2 = game.record_hand("rifki", [0, 1, 0, 0])
    assert r2.points == [0, -320, 0, 0]
    print("  ✓ Rıfkı ceza eli testi başarılı.")

    print("\n✅ TÜM TESTLER BAŞARIYLA TAMAMLANDI!")


if __name__ == "__main__":
    run_unit_tests()
