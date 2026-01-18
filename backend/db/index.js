const { Pool } = require('@neondatabase/serverless');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  getClient: async () => {
    const client = await pool.connect();
    const query = client.query;
    const release = client.release;
    
    // Set a timeout of 5 seconds
    const timeout = setTimeout(() => {
      console.error('A client has been checked out for more than 5 seconds!');
      console.error(`The last executed query on this client was: ${client.lastQuery}`);
    }, 5000);

    // Monkey patch the query method to keep track of the last query executed
    client.query = (...args) => {
      client.lastQuery = args[0];
      return query.apply(client, args);
    };

    client.release = () => {
      // Clear the timeout
      clearTimeout(timeout);
      // Reset the query method
      client.query = query;
      client.release = release;
      return release.apply(client);
    };

    return client;
  }
};
