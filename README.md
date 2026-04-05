# Territory Runner 🏃‍♂️🗺️

A gamified running app where users capture territories on a map, compete on leaderboards, and build a social running community.

## ✨ New Features (v1.1)

🔐 **Google OAuth Login** - Sign up with just one click using your Google account  
📧 **Professional Emails** - Beautiful HTML email templates for password reset & verification  
🚀 **Free Deployment** - Deploy to production using Railway (backend) and Vercel (frontend)  

## Features 🎮

- **Real-time GPS Tracking**: Track runs with live map visualization
- **Territory Capture**: Control map zones as you run; built from your run route
- **Social Features**: Follow friends, view activity feeds, compete on leaderboards
- **XP & Progression**: Earn experience points and level up through runs
- **Anti-Cheat System**: Validate runs using GPS patterns and speed analysis
- **Challenges**: Join and compete in community running challenges
- **Cross-Platform**: iOS, Android, and Web (preview mode)
- **Multiple Auth Methods**: Email/Password + Google OAuth

## Quick Start 🚀

**New to the project?** Start here:
- [LOCAL_SETUP_GUIDE.md](LOCAL_SETUP_GUIDE.md) - Setup locally in 5 minutes
- [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) - See what's new

**Want to deploy?** Follow this:
- [DEPLOYMENT_FREE_GUIDE.md](DEPLOYMENT_FREE_GUIDE.md) - Deploy for FREE

**Need details?** Check these:
- [QUICKSTART.md](QUICKSTART.md) - Developer quickstart  
- [EXPO_SETUP.md](EXPO_SETUP.md) - Mobile app setup
- [OTP_EMAIL_SETUP.md](OTP_EMAIL_SETUP.md) - Email configuration

## Architecture

### Frontend
- **Framework**: React Native with Expo/TypeScript
- **State Management**: React Hooks + Context API
- **Navigation**: React Navigation with Bottom Tabs
- **Maps**: react-native-maps
- **Location**: expo-location for GPS tracking
- **Styling**: StyleSheet (platform-specific)

### Backend
- **Framework**: FastAPI (Python 3.10+)
- **Database**: PostgreSQL with PostGIS (geospatial)
- **Auth**: JWT + Firebase + Local Email/Password
- **Email**: SMTP (OTP verification)
- **API Style**: RESTful

### Mobile App Versions
- **iOS**: iOS 13+
- **Android**: Android 5+
- **Web**: Browser preview (maps disabled)

## Project Structure

```
runner/
├── backend/              # FastAPI server
│   ├── main.py          # Entry point
│   ├── db.py            # Database config
│   ├── models/          # SQLAlchemy ORM models
│   ├── services/        # Business logic
│   ├── routes/          # API endpoints
│   ├── middleware/      # Auth middleware
│   ├── migrations/      # Database migrations
│   ├── requirements.txt # Python dependencies
│   └── migrate.py       # Migration runner
│
├── frontend/            # Expo/React Native app
│   ├── App.tsx          # Root component
│   ├── app.json         # Expo configuration
│   ├── package.json     # NPM dependencies
│   ├── src/
│   │   ├── screens/     # Page components
│   │   ├── components/  # UI components
│   │   ├── services/    # API client
│   │   ├── navigation/  # Navigation structure
│   │   ├── hooks/       # Custom React hooks
│   │   ├── utils/       # Helper functions
│   │   └── types/       # TypeScript definitions
│   └── assets/          # Icons, images
│
├── directives/          # Module documentation
├── execution/           # Template files
├── DEPLOYMENT.md        # Production setup
├── QUICKSTART.md        # Developer quickstart
└── README.md           # This file
```

## API Endpoints

### Authentication
```
POST   /api/auth/local/register        Create account
POST   /api/auth/local/login            Login
POST   /api/auth/local/verify-otp       Verify email OTP
POST   /api/auth/local/forgot-password  Request password reset
POST   /api/auth/local/resend-otp       Resend OTP code
POST   /api/auth/dev-register           Dev-only quick register
```

### Runs
```
POST   /api/runs/start                  Start a new run
POST   /api/runs/{id}/points            Add GPS breadcrumbs
POST   /api/runs/{id}/finish            Complete run & compute metrics
GET    /api/runs/{id}                   Get run details
GET    /api/runs/user/{user_id}         Get user's run history
```

### Territories
```
POST   /api/territories/process/{run_id}    Analyze run for territories
GET    /api/territories/user/{user_id}     Get user's territories
GET    /api/territories/area               Get territories in map bbox
GET    /api/disputes/user/{user_id}        Get territory disputes
```

### Social
```
GET    /api/social/profile/{user_id}       Get user profile
PUT    /api/social/profile/{user_id}       Update profile
POST   /api/social/follow                  Follow user
POST   /api/social/unfollow                Unfollow user
GET    /api/social/is-following            Check if following
GET    /api/social/feed/personal/{uid}     Personal activity feed
GET    /api/social/feed/friends/{uid}      Friends' activity feed
GET    /api/social/leaderboard             Global leaderboard
GET    /api/social/leaderboard/friends/{uid} Friends leaderboard
```

### Progression
```
GET    /api/progression/status/{user_id}   Get XP & level
GET    /api/progression/challenges         List active challenges
POST   /api/progression/challenges/join    Join challenge
GET    /api/progression/challenges/{id}/board Challenge leaderboard
```

### Documentation
```
GET    /                                    Welcome message
GET    /docs                                Interactive API docs (Swagger)
GET    /redoc                               ReDoc API documentation
```

## Technology Details

### Frontend Stack
| Tool | Version | Purpose |
|------|---------|---------|
| React Native | 0.81.5 | Mobile framework |
| Expo | ~54.0 | Managed React Native platform |
| TypeScript | ~5.9 | Type safety |
| React Navigation | ^7.15 | Navigation library |
| Axios | ^1.7 | HTTP client |
| Expo Location | ~19.0 | GPS tracking |
| React Native Maps | 1.20.1 | Map visualization |
| Expo Notifications | ~0.32 | Push notifications |

### Backend Stack
| Tool | Version | Purpose |
|------|---------|---------|
| FastAPI | ≥0.115 | Web framework |
| Uvicorn | ≥0.30 | ASGI server |
| SQLAlchemy | ≥2.0 | ORM |
| AsyncPG | ≥0.29 | PostgreSQL driver |
| GeoAlchemy2 | ≥0.15 | PostGIS ORM |
| Shapely | ≥2.0 | Geometry operations |
| PyJWT | ≥2.8 | JWT tokens |
| Firebase Admin | ≥6.5 | Firebase integration |

### Database
- **PostgreSQL**: 14+ (spatial-aware)
- **PostGIS**: 3.0+ (geospatial queries)
- **Indexes**: Optimized for location queries

## Development Workflow

### Local Development
1. Start PostgreSQL
2. Run migrations
3. Start backend API server
4. Start Expo development server
5. View app via Expo Go or emulator

### Making Changes
- **Frontend**: Changes auto-reload in Expo
- **Backend**: Use `--reload` flag for auto-restart on file changes
- **Database**: Apply migrations with `python migrate.py`

### Testing
- **API**: Use http://localhost:8000/docs (Swagger UI)
- **App**: Connect via Expo Go on device/emulator
- **Database**: Use `psql` command line tool

## Deployment Checklist

- [ ] Environment variables configured
- [ ] Database migrations applied
- [ ] Firebase credentials set up
- [ ] Email service configured (SMTP)
- [ ] Google Maps API key added
- [ ] Frontend build tested
- [ ] Backend tested with test data
- [ ] API endpoints verified
- [ ] All screens tested on device
- [ ] Error handling verified
- [ ] Logging configured
- [ ] Security review complete

## Troubleshooting

### Common Issues
- **App won't start**: Check backend is running and API URL is correct
- **Territories not appearing**: Ensure PostGIS installed, migrations ran
- **Emails not sending**: Verify SMTP credentials and less-secure access enabled
- **Database errors**: Check PostgreSQL running and connection string correct
- **Maps not showing**: Verify Google Maps API key and valid coordinates

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed troubleshooting.

## Future Enhancements

- [ ] Strava & Garmin integration
- [ ] Real-time multiplayer raids
- [ ] Achievement badges & rewards
- [ ] Video replays of top runs
- [ ] Weather-based challenges
- [ ] Team-based competitions
- [ ] Maps, routes, and guidance features
- [ ] Community event organization
- [ ] AI-generated personalized workouts

## Security 🔒

- JWT tokens for authenticated requests
- Password hashing with PBKDF2
- Email OTP verification for sensitive operations
- CORS middleware configured
- SQL injection prevention via ORM
- Rate limiting on auth endpoints
- GPS validation to prevent cheating

## Contributing 🤝

This is a private project. For internal development:
1. Create a feature branch
2. Make changes locally
3. Test thoroughly
4. Submit PR with description
5. Code review required before merge

## License

Proprietary - Territory Runner © 2026

## Support

For issues or questions:
1. Check [DEPLOYMENT.md](DEPLOYMENT.md)
2. Review [directives/](directives/) for module docs
3. Check API documentation at `/docs` endpoint
4. Review backend logs for errors
5. Check Expo console logs on device

---

**Made with ❤️ for runners and territory enthusiasts**

Last Updated: March 2026 | Version: 1.0.0
