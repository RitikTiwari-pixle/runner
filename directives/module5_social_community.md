# Directive: Module 5 — Social & Community

## Objective
Enable social interaction: user profiles, follow system, activity feed, and leaderboards.

## Features

### User Profiles
- Full profile with computed stats (followers, following, run count, territory count)
- Update display name, avatar, city, state, phone
- Search users by username or display name (ILIKE)

### Follow System
- Follow / unfollow with self-follow prevention
- Get followers and following lists with user info
- Check `is_following` status between two users

### Activity Feed
- **Personal feed**: user's own activity history
- **Friends feed**: activities from users you follow + yourself
- Event types: `run_completed`, `territory_captured`, `territory_stolen`, `level_up`
- Auto-created in `finish_run` pipeline

### Leaderboards
- **Global**: all users, sorted by territory / distance / XP
- **City / State**: filter by location
- **Friends only**: among people you follow
- All boards return rank, avatar, key stats

## API Endpoints (14)
- 3 profile endpoints (get, update, search)
- 5 follow endpoints (follow, unfollow, followers, following, is-following)
- 2 feed endpoints (personal, friends)
- 2 leaderboard endpoints (global, friends)
- Plus: profile update and search

## Integration
Activity feed entries created automatically in the `finish_run` pipeline.
No manual posting needed — every run shows up in friends' feeds.
