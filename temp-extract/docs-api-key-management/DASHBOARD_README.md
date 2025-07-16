# API Key Management Dashboard

A modern, real-time web dashboard for managing API keys with comprehensive security features, performance monitoring, and audit logging.

## Features

### 🔑 Key Management
- Create, view, rotate, and delete API keys
- Real-time status updates via WebSocket
- Secure key display with masking
- One-click key copying
- Bulk operations support

### ✅ Key Validation
- Real-time key validation interface
- Performance metrics tracking
- Validation history and analytics
- Common failure reason analysis

### 🔄 Rotation Scheduling
- Automated key rotation policies
- Configurable rotation frequencies
- Email/webhook notifications
- Upcoming rotation calendar view

### 📊 Performance Metrics
- Real-time performance dashboards
- Response time analytics
- Request volume tracking
- Error rate monitoring
- System health indicators

### 📝 Audit Logging
- Comprehensive activity logging
- Advanced filtering and search
- Export capabilities
- Detailed event tracking

### 🔒 Security Settings
- HTTPS enforcement
- IP whitelisting
- Rate limiting
- Failed attempt lockouts
- Configurable security policies

## Tech Stack

- **Frontend**: React 18, Tailwind CSS, Recharts
- **Real-time**: Socket.io for WebSocket connections
- **Routing**: React Router v6
- **State Management**: React Hooks
- **Build Tool**: Vite
- **Backend**: Express.js with Socket.io

## Installation

1. Install frontend dependencies:
```bash
cd dashboard
npm install
```

2. Install server dependencies:
```bash
npm install --prefix . express socket.io cors body-parser
```

## Running the Application

1. Start the API server (port 3001):
```bash
node server.js
```

2. Start the dashboard development server (port 3000):
```bash
cd dashboard
npm run dev
```

3. Open http://localhost:3000 in your browser

## Project Structure

```
dashboard/
├── src/
│   ├── components/       # Reusable UI components
│   │   └── Layout.jsx   # Main layout wrapper
│   ├── pages/           # Page components
│   │   ├── Dashboard.jsx
│   │   ├── KeyManagement.jsx
│   │   ├── KeyValidation.jsx
│   │   ├── RotationSchedule.jsx
│   │   ├── PerformanceMetrics.jsx
│   │   ├── AuditLogs.jsx
│   │   └── SecuritySettings.jsx
│   ├── hooks/           # Custom React hooks
│   │   ├── useSocket.jsx
│   │   └── useAuth.jsx
│   ├── styles/          # CSS files
│   │   └── index.css
│   ├── App.jsx          # Main app component
│   └── main.jsx         # Entry point
├── public/              # Static assets
├── server.js            # Express + Socket.io server
├── package.json         # Frontend dependencies
└── vite.config.js       # Vite configuration
```

## API Endpoints

### Dashboard
- `GET /api/dashboard/stats` - Dashboard statistics
- `GET /api/dashboard/activity` - Recent activity
- `GET /api/dashboard/performance` - Performance data
- `GET /api/dashboard/distribution` - Key distribution

### Keys
- `GET /api/keys` - List all keys
- `POST /api/keys` - Create new key
- `DELETE /api/keys/:id` - Delete key
- `POST /api/keys/:id/rotate` - Rotate key

### Validation
- `POST /api/validation/validate` - Validate a key
- `GET /api/validation/stats` - Validation statistics
- `GET /api/validation/history` - Validation history

### Rotation
- `GET /api/rotation/schedules` - List schedules
- `POST /api/rotation/schedules` - Create schedule
- `GET /api/rotation/stats` - Rotation statistics

### Metrics
- `GET /api/metrics/performance` - Performance metrics

### Audit
- `GET /api/audit/logs` - Audit logs with pagination
- `GET /api/audit/export` - Export logs

### Security
- `GET /api/security/settings` - Get settings
- `PUT /api/security/settings` - Update settings

## WebSocket Events

### Client → Server
- `connection` - Initial connection
- `disconnect` - Client disconnect

### Server → Client
- `key:created` - New key created
- `key:updated` - Key updated
- `key:rotated` - Key rotated
- `key:deleted` - Key deleted
- `metrics:update` - Metrics update
- `alert:new` - New security alert

## Security Considerations

1. **Authentication**: Implement proper authentication before production use
2. **HTTPS**: Always use HTTPS in production
3. **CORS**: Configure CORS appropriately for your domain
4. **Rate Limiting**: Implement rate limiting on all endpoints
5. **Input Validation**: Add comprehensive input validation
6. **Database**: Replace in-memory storage with a proper database
7. **Encryption**: Encrypt sensitive data at rest and in transit

## Customization

### Theme Colors
Edit `tailwind.config.js` to customize the color scheme:
```javascript
theme: {
  extend: {
    colors: {
      primary: {
        // Your custom colors
      }
    }
  }
}
```

### Adding New Pages
1. Create a new component in `src/pages/`
2. Add route in `src/App.jsx`
3. Add navigation item in `src/components/Layout.jsx`

### Extending API
1. Add new endpoint in `server.js`
2. Create corresponding UI in dashboard
3. Add WebSocket events if real-time updates needed

## Production Deployment

1. Build the frontend:
```bash
npm run build
```

2. Serve static files from Express
3. Configure environment variables
4. Set up proper database
5. Implement authentication
6. Configure SSL/TLS
7. Set up monitoring and logging

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details