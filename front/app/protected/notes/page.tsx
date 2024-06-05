import { createClient } from '@/utils/supabase/server';
import { SubmitButton } from '../../login/submit-button';
import { Booking } from "../../../../shared-types/src/booking";

export default async function Notes() {
  const supabase = createClient();
  const { data: notes } = await supabase.from("bookings").select();

  
  const createNote = async (formData: FormData) => {
    "use server";
    
    const url = 'https://authenticate-snss73hxzq-uc.a.run.app'; // Your Firebase function URL
    const supabase = createClient();
    let sesh = await supabase.auth.getSession()
    let token = sesh.data.session?.access_token;
    const note = formData.get("content") as string;


    let booking:Booking = {
      encodingVersion: 1,
      client: {
        name: "Donald Trump",
        email: "donald@trump.com",
        phone: "123456789"
      },
      bookingName: "Wedding",
      bookingType: "Event",
      paymentMethod: "Cash",
      notes: note,
      status: "Pending",
      createdDateTime: "2024-06-09T09:00:00-07:00",
      createdBy: "Nathik",
      updatedDateTime: "2024-06-09T09:00:00-07:00",
      updatedBy: "Nathik",
      followUpDate: "2022-06-09",
      events: [
        {
          eventName: "Mehendi",
          notes: "This is a note",
          startDateTime: "2024-06-09T09:00:00-07:00",
          endDateTime: "2024-06-09T17:00:00-07:00",
          numberOfGuests: 100,
          properties: ["Property 1", "Property 2"],
          valetService: true,
          djService: true,
          kitchenService: true,
          overNightStay: true,
          overNightGuests: 10
        },
        {
          eventName: "Wedding",
          notes: "This is a note",
          startDateTime: "2024-06-09T09:00:00-07:00",
          endDateTime: "2024-06-09T17:00:00-07:00",
          numberOfGuests: 100,
          properties: ["Property 1", "Property 2"],
          valetService: true,
          djService: true,
          kitchenService: true,
          overNightStay: true,
          overNightGuests: 10
        }
      ],
      costs: [
        {
          name: "Bluehouse",
          amount: 1000
        },
        {
          name: "Cleaning",
          amount: 2000
        },
        {
          name: "EB",
          amount: 3000
        }
      ],
      finalCost: 6000,
      payments: [
        {
          date: "2022-06-09",
          paymentMethod: "Cash",
          amount: 3000,
          receivedBy: "Nathik"
        }
      ]
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(booking)
      });
      const data = await response.json(); 
      console.log('Response from Firebase function:', data);
      // You might want to handle the data further or redirect the user based on the response
    } catch (error) {
      console.error('Error calling Firebase function:', error);
    }
  }

  return (
    <div>
      <ul>
        {notes?.map(note => (
          <li key={note.id}>
            <strong>ID:</strong> {note.id} <br />
            <strong>Text:</strong> {JSON.stringify(note.json, null, 2)}
          </li>
        ))}
      </ul>
      <form>
      <label className="text-md" htmlFor="content">
          Content
        </label>
        <input
          className="rounded-md px-4 py-2 bg-inherit border mb-6"
          name="content"
          placeholder="Enter note text here"
          required
        />
      <SubmitButton
        formAction={createNote}
        className="border border-foreground/20 rounded-md px-4 py-2 text-foreground mb-2"
        pendingText="Creating Note..."
      >
        Creat Note
      </SubmitButton>
      </form>
    </div>
  );
}