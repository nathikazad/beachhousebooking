import Head from 'next/head';

const PrivacyPolicy = () => {
  return (
    <>
      <Head>
        <title>Privacy Policy | Beach House Operations</title>
        <meta
          name="description"
          content="Privacy policy for the Beach House Operations ChatGPT Action."
        />
      </Head>

      <article className="mx-auto w-full max-w-3xl px-6 py-12 text-slate-800">
        <h1 className="mb-2 text-3xl font-bold text-slate-950">Privacy Policy</h1>
        <p className="mb-8 text-sm text-slate-500">Effective August 3, 2026</p>

        <div className="space-y-7 leading-7">
          <section>
            <h2 className="mb-2 text-xl font-bold text-slate-950">About this service</h2>
            <p>
              Beach House Operations is a private business assistant that lets authorized users
              retrieve booking, event, payment, and operational information through ChatGPT.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-bold text-slate-950">Information processed</h2>
            <p>
              When an authorized user asks a question, the Action processes the request parameters
              needed to retrieve the requested business information. Responses may contain booking
              details, customer information, financial figures, employee performance information,
              and event schedules.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-bold text-slate-950">How information is used</h2>
            <p>
              Information is used only to answer authorized operational questions, protect the
              service, troubleshoot failures, and maintain its reliability. It is not sold or used
              for advertising.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-bold text-slate-950">Storage and service providers</h2>
            <p>
              Business records remain in the booking system. The Action does not intentionally add
              ChatGPT prompts or responses to the booking database. Hosting, database, and ChatGPT
              providers may process and retain technical request data according to their own terms
              and privacy policies.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-bold text-slate-950">Access and security</h2>
            <p>
              The service is intended only for people authorized by Beach House Booking. Access is
              protected using authentication controls, and users must not share access with
              unauthorized people.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-xl font-bold text-slate-950">Questions and requests</h2>
            <p>
              To ask a privacy question or request correction or deletion of applicable business
              data, contact the Beach House Booking administrator through your usual business
              contact channel.
            </p>
          </section>
        </div>
      </article>
    </>
  );
};

export default PrivacyPolicy;
