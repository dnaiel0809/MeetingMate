import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly', 'https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/contacts.other.readonly', 'https://www.googleapis.com/auth/directory.readonly', 'https://www.googleapis.com/auth/contacts.readonly'];

function App() {
  const [events, setEvents] = useState([]);
  const [authenticated, setAuthenticated] = useState(false);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    if (code && !authenticated) {
      axios.post('https://meetingmate-server-edba0f4db3dc.herokuapp.com/api/calendar/authenticate', { code })
        .then(response => {
          console.log(response.data);
          setAuthenticated(true);
          fetchEvents();
        })
        .catch(error => console.error('Error authenticating:', error));
    }
  }, []);

  const authenticate = () => {
    window.location.href = `https://accounts.google.com/o/oauth2/auth?client_id=${process.env.REACT_APP_CLIENT_ID}&redirect_uri=${process.env.REACT_APP_REDIRECT_URI}&response_type=code&scope=${SCOPES.join(' ')}&access_type=offline`;
  };

  const logout = () => {
    setAuthenticated(false);
    setEvents([]);
    // Optionally redirect or clear session on server
  };

  const fetchEvents = async () => {
    try {
      const response = await axios.get(`https://meetingmate-server-edba0f4db3dc.herokuapp.com/api/calendar/events?filter=${filter}`);
      console.log(response.data.events)
      setEvents(response.data.events);
    } catch (error) {
      console.error('Error fetching events:', error);
    }
  };

  const sendAllReminders = async () => {
    try {
      for (let event of events) {
        await axios.post('https://meetingmate-server-edba0f4db3dc.herokuapp.com/api/calendar/sendReminder', { event });
      }
      alert('All reminders sent');
    } catch (error) {
      console.error('Error sending all reminders:', error);
    }
  };
  console.log(events.attendees)
  return (
    <div className="App">
      <div className='m-4'>
        {!authenticated && <button className="flex w-15 justify-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          onClick={authenticate}>Login</button>}
        {authenticated && <button className="flex w-15 justify-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          onClick={logout}>Logout</button>}
      </div>

      <div className='flex flex-col mt-32 mx-64' >
        <h1 className='text-8xl font-medium tracking-widest m-8'>MeetingMate</h1>
        {authenticated&&
          <div>
            <div className='grid grid-cols-12'>
              <input type="text" placeholder="Filter events" className="col-start-4 col-span-4 block w-full m-4 rounded-md border-1 py-1.5 pl-7 pr-20 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                onChange={e => setFilter(e.target.value)} value={filter} />
              <button className="col-start-8 col-span-2 my-4 mx-8 rounded-md bg-transparent text-sm border-2 font-semibold leading-6 text-black shadow-sm hover:bg-indigo-500 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                onClick={fetchEvents}>Fetch Events</button>
            </div>
            <div className='grid grid-cols-12'>
              <button className="col-start-6 col-span-2 m-4 rounded-md bg-transparent px-3 py-1.5 text-sm border-2 font-semibold leading-6 text-black shadow-sm hover:bg-indigo-500 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                onClick={sendAllReminders}>Send All Reminders</button>
            </div>
            <ul role="list" className="divide-y divide-gray-100">
              {events.length > 0 ? (
                events.map(event => (
                  <li key={event.id} className="flex justify-between gap-x-6 py-5">
                    <div className="flex min-w-0 gap-x-4">
                      {event.attendees && event.attendees.map((attendee, index) => (
                        !attendee.organizer ?
                          (<div className="min-w-0 flex-auto text-left">
                            <p className="text-sm font-semibold leading-6 text-gray-900">{attendee.name}</p>
                            <p className="mt-1 truncate text-xs leading-5 text-gray-500">{attendee.email}</p>
                          </div>) : null
                      ))}
                    </div>

                    <div className="hidden shrink-0 sm:flex sm:flex-col sm:items-end">
                      <p className="text-sm leading-6 text-gray-900">{event.summary}</p>
                      <p className="mt-1 text-xs leading-5 text-gray-500">
                        {new Date(event.start.dateTime).toLocaleString('en-US')}
                      </p>

                    </div>
                  </li>
                ))) : (
                <li className="text-center py-5">
                  <p className="text-sm font-semibold leading-6 text-gray-500">No events</p>
                </li>)}
            </ul>
          </div>}
      </div>
    </div>
  );
}

export default App;
