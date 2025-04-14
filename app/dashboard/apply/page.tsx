import ApplicationForm from '@/components/application-form';

export const metadata = {
  title: 'Apply - Join Our Team',
  description: 'Apply for open positions in our organization',
};

export default function ApplyPage() {
  return (
    <div className="container mx-auto px-4">
      <ApplicationForm />
    </div>
  );
}