import ErrorScreen from '@/components/ErrorScreen';

// An unknown address: back to the map instead of the framework's 404 page.
export default function NotFound() {
  return <ErrorScreen kind="notFound" />;
}
