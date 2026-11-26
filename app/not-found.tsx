import Link from "next/link";
import { NotFoundView } from "@/components/detail";

export default function NotFound() {
  return (
    <div>
      <NotFoundView label="this page" />
      <p style={{ textAlign: "center", marginBottom: 60 }}>
        <Link className="link-more" href="/">
          Back to home
        </Link>
      </p>
    </div>
  );
}
