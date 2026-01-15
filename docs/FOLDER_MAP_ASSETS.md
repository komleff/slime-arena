# Карта структуры папки /assets

**Дата:** 14 января 2026  
**Версия:** 1.0  
**Статус:** Актуально

---

## 📂 Полная структура (дерево файлов)

```
assets/
├── backgrounds/               [5 файлов, ~20.3 MB]
│   ├── bg_main_menu.png
│   ├── bg_loading_screen.png
│   ├── bg_loading_screen_fake.png
│   ├── bg_gameplay_floor_tile.png
│   └── bg_gameplay_floor_tile_2.png
│
├── buttons/                   [5 файлов, ~0.7 MB]
│   ├── btn_close_red.png
│   ├── btn_jelly_red.png
│   ├── btn_jelly_darkblue.png
│   ├── btn_jelly_darkgreen.png
│   └── btn_jelly_gold.png
│
├── hud/                       [13 файлов, ~4.0 MB]
│   ├── hud_avatar_frame_cookie.png
│   ├── hud_avatar_frame_cookie_top.png
│   ├── hud_avatar_frame_cookie_bottom.png
│   ├── hud_profile_base_chocolate.png
│   ├── hud_level_badge_star_blue.png
│   ├── hud_level_badge_star_darkblue.png
│   ├── hud_level_badge_star_green.png
│   ├── hud_level_badge_star_pink.png
│   ├── avatar_hero_girl.png
│   └── avatar_hero_shief.png
│
├── icons/                     [9 файлов, ~9.2 MB]
│   ├── icon_menu_settings.png
│   ├── icon_menu_leaderboard.png
│   ├── icon_menu_skins.png                (большой файл, 6.0 MB)
│   ├── icon_currency_coin.png
│   ├── icon_currency_gem.png
│   ├── icon_alert_cookie.png
│   ├── icon_error_burnt.png
│   ├── icon_wifi_broken.png
│   └── icon_logotype.png
│
├── loot/                      [4 файлов, ~1.1 MB]
│   ├── orb_blue.png
│   ├── orb_gold.png
│   ├── orb_green.png
│   └── orb_red.png
│
├── panels/                    [1 файл, ~4.4 MB]
│   └── panel_modal_cookie.png
│
├── props/                     [3 файлов, ~1.3 MB] ✅ ИСПРАВЛЕНО
│   ├── prop_obstacle_rock.png
│   ├── prop_obstacle_spikes.png
│   └── prop_wall_bouncy.png
│
├── skins/                     [3 файлов, ~4.6 MB]
│   └── lobby/
│       ├── hero_skin_current.png
│       ├── hero_skin_current_alt.png
│       └── hero_skin_kolobok.png
│
├── sprites/                   [СИСТЕМА СПРАЙТОВ]
│   └── slimes/
│       ├── SYSTEM.md                      (документация)
│       ├── README.md
│       ├── INTEGRATION_EXAMPLE.md
│       │
│       └── base/                          [25 файлов, ~40.0 MB]
│           ├── hero_blin_v1.png           ⭐ NEW (v0.4.2)
│           ├── hero_blin_v2.png           ⭐ NEW (v0.4.2)
│           ├── hero_burger_v1.png         ⭐ NEW (v0.4.2)
│           ├── hero_burger_v2.png         ⭐ NEW (v0.4.2)
│           ├── slime-base.png
│           ├── slime-angrybird.png
│           ├── slime-astronaut.png
│           ├── slime-cccp.png
│           ├── slime-crazy.png
│           ├── slime-crystal.png
│           ├── slime-cyberneon.png
│           ├── slime-frost.png
│           ├── slime-greeendragon.png
│           ├── slime-mecha.png
│           ├── slime-pinklove.png
│           ├── slime-pirate.png
│           ├── slime-pumpkin.png
│           ├── slime-reddragon.png
│           ├── slime-redfire.png
│           ├── slime-samurai.png
│           ├── slime-shark.png
│           ├── slime-tomato.png
│           ├── slime-toxic.png
│           ├── slime-wizard.png
│           └── slime-zombi.png
│
└── templates/                 [2 файлов, ~24.7 KB]
    ├── main.html              (главный шаблон UI)
    └── BattleScreen.html      (экран боя)
```

---

## 📊 Статистика

### По папкам

| Папка | Файлов | Размер | Назначение |
|-------|--------|--------|-----------|
| **backgrounds/** | 5 | 20.3 MB | Фоны экранов |
| **sprites/slimes/base/** | 25 | 40.0 MB | Спрайты слаймов (основные скины) |
| **icons/** | 9 | 9.2 MB | Иконки UI |
| **panels/** | 1 | 4.4 MB | Панели модалей |
| **skins/lobby/** | 3 | 4.6 MB | Скины в лобби |
| **hud/** | 13 | 4.0 MB | HUD элементы |
| **loot/** | 4 | 1.1 MB | Лут объекты (орбы) |
| **buttons/** | 5 | 0.7 MB | Кнопки |
| **props/** | 3 | 1.3 MB | Объекты окружения |
| **templates/** | 2 | ~25 KB | HTML шаблоны |

**ВСЕГО:** 70 файлов, ~86 MB

### По расширениям

| Расширение | Количество | Размер |
|-----------|-----------|--------|
| `.png` | 65 | ~86 MB |
| `.md` | 3 | ~14 KB |
| `.html` | 2 | ~25 KB |

---

## 🏷️ Префиксы нейминга (Gold Standard)

### Используемые префиксы

| Префикс | Папка | Статус | Примеры |
|---------|-------|--------|---------|
| `bg_` | backgrounds/ | ✅ | `bg_main_menu.png` |
| `btn_` | buttons/ | ✅ | `btn_jelly_red.png` |
| `hud_` | hud/ | ✅ | `hud_avatar_frame_cookie.png` |
| `icon_` | icons/ | ✅ | `icon_currency_coin.png` |
| `orb_` | loot/ | ⚠️ | `orb_blue.png` (нет префикса) |
| `panel_` | panels/ | ✅ | `panel_modal_cookie.png` |
| `prop_` | props/ | ✅ | `prop_obstacle_rock.png` |
| `hero_` | skins/ | ✅ | `hero_skin_current.png` |
| —  | sprites/slimes/base/ | ⚠️ | `slime-*.png`, `hero_*.png` |

### ⚠️ Неправильные примеры (найдены)

| Файл | Проблема | Рекомендация |
|------|----------|--------------|
| `avatar_hero_girl.png` | Без префикса | `hud_avatar_hero_girl.png` |
| `avatar_hero_shief.png` | Без префикса | `hud_avatar_hero_shief.png` |
| `orb_blue.png` | Без префикса (должно быть `loot_` или `prop_`) | `loot_orb_blue.png` |
| `orb_gold.png` | Без префикса | `loot_orb_gold.png` |
| `orb_green.png` | Без префикса | `loot_orb_green.png` |
| `orb_red.png` | Без префикса | `loot_orb_red.png` |

---

## 🔄 История изменений

### v1.0 (14 января 2026)

- ✅ Создана полная карта структуры assets/
- ✅ Добавлена статистика по папкам
- ✅ Проверены префиксы нейминга
- ✅ Выявлены 6 файлов без корректных префиксов
- ⚠️ Рекомендуется исправить префиксы для `avatar_*.png` и `orb_*.png`

---

## 💡 Рекомендации

1. **Исправить prefixes:**
   - `avatar_hero_girl.png` → `hud_avatar_hero_girl.png`
   - `avatar_hero_shief.png` → `hud_avatar_hero_shief.png`
   - `orb_*.png` → `loot_orb_*.png` (все 4 файла)

2. **Оптимизация размеров:**
   - `icon_menu_skins.png` (6.0 MB) — огромный файл, рекомендуется сжатие
   - Общий размер sprites: 40 MB — рассмотреть WebP вместо PNG

3. **Организация спрайтов:**
   - Текущая структура: `sprites/slimes/base/` — хорошо
   - Рассмотреть подпапки по типам: `base/`, `animated/`, `effects/`

---

**Ответственный:** Art Director (Gemini-3-Pro)  
**Источники:** ASSETS_MAP_v1.2.md, AGENT_ROLES.md
