import { useEffect, useState } from "react";

// Match the phone composition in style.css, including short landscape phones.
const phoneQuery = "(max-width: 620px), (max-width: 900px) and (max-height: 500px) and (pointer: coarse)";
export function usePhoneLayout() {
  const [phone, setPhone] = useState(() => matchMedia(phoneQuery).matches);
  useEffect(() => {
    const query = matchMedia(phoneQuery);
    const update = () => setPhone(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return phone;
}
