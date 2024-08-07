import BookingFormComponent from "@/components/BookingForm";

const CreateBookingPage = () => {
  return (
    <div className='h-full flex items-start justify-center my-4 w-full'>
      <BookingFormComponent />
    </div>
  );
}
CreateBookingPage.useNoLayout = true;
export default CreateBookingPage;