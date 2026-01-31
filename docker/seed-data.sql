-- =============================================================================
-- Slime Arena Initial Data Seed
-- Version: 0.7.3
-- Description: Seeds the first player (Дмитрий Комлев) with test ratings
-- =============================================================================

-- First, ensure uuid-ossp extension is available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- First Player: Дмитрий Комлев (Yandex OAuth)
-- =============================================================================

-- Generate a consistent UUID for the first player
DO $$
DECLARE
    first_user_id UUID := '41d215cb-6657-4ea9-960e-a64c668c9ac3';
    first_match_id UUID := 'fbb14f6c-fdbd-4c97-b199-2859c1980a1b';
BEGIN
    -- Insert user (if not exists)
    INSERT INTO users (
        id,
        nickname,
        is_anonymous,
        is_banned,
        avatar_url,
        registration_skin_id,
        created_at,
        updated_at
    ) VALUES (
        first_user_id,
        'Дмитрий Комлев',
        FALSE,
        FALSE,
        'https://avatars.yandex.net/get-yapic/0/0-0/islands-200',
        'slime_green',
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO NOTHING;

    -- Insert OAuth link (Yandex)
    INSERT INTO oauth_links (
        user_id,
        auth_provider,
        provider_user_id,
        created_at
    ) VALUES (
        first_user_id,
        'yandex',
        'yandex_seed_user_001',
        NOW()
    )
    ON CONFLICT (user_id, auth_provider) DO NOTHING;

    -- Insert leaderboard total mass
    INSERT INTO leaderboard_total_mass (
        user_id,
        total_mass,
        matches_played,
        updated_at
    ) VALUES (
        first_user_id,
        2723,
        3,
        NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
        total_mass = EXCLUDED.total_mass,
        matches_played = EXCLUDED.matches_played,
        updated_at = NOW();

    -- Insert leaderboard best mass
    INSERT INTO leaderboard_best_mass (
        user_id,
        best_mass,
        best_match_id,
        players_in_match,
        achieved_at,
        updated_at
    ) VALUES (
        first_user_id,
        1227,
        first_match_id,
        8,
        NOW(),
        NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
        best_mass = EXCLUDED.best_mass,
        best_match_id = EXCLUDED.best_match_id,
        updated_at = NOW();

    -- Insert rating awards for idempotency
    INSERT INTO rating_awards (user_id, match_id, awarded_at)
    VALUES
        (first_user_id, first_match_id, NOW()),
        (first_user_id, 'd054eaa9-e442-4ebf-ab1b-81b46a077020', NOW()),
        (first_user_id, '71b9d506-bcc5-4c87-b549-1c857d9e5a69', NOW())
    ON CONFLICT (user_id, match_id) DO NOTHING;

    RAISE NOTICE 'First player seeded: Дмитрий Комлев (id: %)', first_user_id;
    RAISE NOTICE 'Total mass: 2723, Best mass: 1227, Matches: 3';
END $$;

-- =============================================================================
-- Verification
-- =============================================================================

-- Show seeded data
SELECT
    u.id,
    u.nickname,
    u.is_anonymous,
    ol.auth_provider,
    ltm.total_mass,
    ltm.matches_played,
    lbm.best_mass
FROM users u
LEFT JOIN oauth_links ol ON u.id = ol.user_id
LEFT JOIN leaderboard_total_mass ltm ON u.id = ltm.user_id
LEFT JOIN leaderboard_best_mass lbm ON u.id = lbm.user_id
WHERE u.nickname = 'Дмитрий Комлев';
