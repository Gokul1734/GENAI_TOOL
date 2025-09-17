import { useState, useEffect } from 'react'
import axios from 'axios'

const Users = () => {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [newUser, setNewUser] = useState({ name: '', email: '' })

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/users`)
      setUsers(response.data)
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }

  const addUser = async (e) => {
    e.preventDefault()
    try {
      await axios.post(`${import.meta.env.VITE_API_URL}/users`, newUser)
      setNewUser({ name: '', email: '' })
      fetchUsers()
    } catch (error) {
      console.error('Error adding user:', error)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  return (
    <div className="card">
      <h2>Users Management</h2>
      
      <div style={{ marginBottom: '2rem' }}>
        <h3>Add New User</h3>
        <form onSubmit={addUser} style={{ display: 'flex', gap: '1rem', alignItems: 'end' }}>
          <div>
            <label>Name:</label>
            <input
              type="text"
              value={newUser.name}
              onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
              required
              style={{ padding: '0.5rem', margin: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
            />
          </div>
          <div>
            <label>Email:</label>
            <input
              type="email"
              value={newUser.email}
              onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
              required
              style={{ padding: '0.5rem', margin: '0.5rem', borderRadius: '4px', border: '1px solid #ddd' }}
            />
          </div>
          <button type="submit" className="btn">Add User</button>
        </form>
      </div>

      <div>
        <h3>User List</h3>
        {loading ? (
          <p>Loading users...</p>
        ) : (
          <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))' }}>
            {users.map((user) => (
              <div key={user._id} style={{ 
                background: '#f8f9fa', 
                padding: '1rem', 
                borderRadius: '8px',
                border: '1px solid #e9ecef'
              }}>
                <h4>{user.name}</h4>
                <p>{user.email}</p>
                <small>ID: {user._id}</small>
              </div>
            ))}
          </div>
        )}
        {users.length === 0 && !loading && (
          <p>No users found. Add some users to get started!</p>
        )}
      </div>
    </div>
  )
}

export default Users
