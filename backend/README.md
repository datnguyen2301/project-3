# Node.js Backend with Express

A simple Node.js backend application using Express.js framework.

## Features

- RESTful API with Express.js
- CORS enabled
- Environment variable configuration
- Example CRUD operations
- Error handling middleware
- Request logging

## Project Structure

```
backend/
├── controllers/         # Business logic
│   └── example.controller.js
├── middleware/          # Custom middleware
│   └── index.js
├── routes/             # API routes
│   └── api.routes.js
├── .env                # Environment variables
├── .gitignore         # Git ignore file
├── package.json       # Project dependencies
├── server.js          # Main application file
└── README.md          # This file
```

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn

## Installation

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
Edit the `.env` file to set your configuration:
```
PORT=3000
NODE_ENV=development
```

## Running the Application

### Development mode (with auto-reload):
```bash
npm run dev
```

### Production mode:
```bash
npm start
```

The server will start on `http://localhost:3000`

## API Endpoints

### Health Check
- **GET** `/api/health` - Check server health status

### Example CRUD Operations
- **GET** `/api/examples` - Get all examples
- **GET** `/api/examples/:id` - Get example by ID
- **POST** `/api/examples` - Create new example
- **PUT** `/api/examples/:id` - Update example
- **DELETE** `/api/examples/:id` - Delete example

## Example Request

```bash
# Get all examples
curl http://localhost:3000/api/examples

# Create new example
curl -X POST http://localhost:3000/api/examples \
  -H "Content-Type: application/json" \
  -d '{"name":"New Example","description":"This is a new example"}'
```

## Development

To add new routes:
1. Create a controller in `controllers/`
2. Create a route file in `routes/`
3. Import and use the route in `server.js`

## License

ISC
