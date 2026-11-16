import { createBrandAction } from "@/app/actions/brands";

export default function NewBrand() {
  return (
    <form action={createBrandAction} className="card p-8 max-w-lg space-y-4">
      <h1>New brand</h1>
      <div><label className="label">Brand name</label><input className="input" name="name" required /></div>
      <div><label className="label">Website</label><input className="input" name="website" placeholder="example.com" /></div>
      <button className="btn-primary">Create brand</button>
    </form>
  );
}
