// import { useParams, useNavigate } from "react-router-dom";
// import { CheckCircle, FileText } from "lucide-react";

// export default function OrderSuccess() {

//   const { orderId } = useParams();
//   const navigate = useNavigate();

//   return (
//     <div className="min-h-[80vh] flex items-center justify-center bg-baba-softbg px-4">

//       <div className="bg-white p-10 rounded-2xl shadow-lg border border-gray-100 text-center max-w-lg w-full">

//         <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
//           <CheckCircle className="w-10 h-10 text-green-600" />
//         </div>

//         <h1 className="font-serif text-3xl text-baba-primary font-bold mb-4">
//           Order Confirmed!
//         </h1>

//         <p className="text-gray-600 mb-8 leading-relaxed">
//           Thank you for choosing Baba Textiles. Your order
//           <span className="font-bold text-baba-primary"> #{orderId}</span>
//           has been placed successfully.
//         </p>

//         <div className="bg-baba-softbg p-4 rounded-lg mb-8 text-left text-sm border border-baba-accent/20">

//           <div className="flex items-center gap-2 mb-2 font-semibold text-baba-primary">
//             <FileText className="w-4 h-4 text-baba-accent" /> Order Summary
//           </div>

//           <div className="flex justify-between text-gray-600 py-1">
//             <span>Order ID</span>
//             <span className="font-mono">{orderId}</span>
//           </div>

//           <div className="flex justify-between text-gray-600 py-1">
//             <span>Status</span>
//             <span className="text-orange-600 font-medium">
//               Processing
//             </span>
//           </div>

//           <div className="flex justify-between text-gray-600 py-1">
//             <span>Date</span>
//             <span>{new Date().toLocaleDateString()}</span>
//           </div>

//         </div>

//         <button
//           onClick={() => navigate("/")}
//           className="bg-baba-primary text-white px-8 py-3 rounded-sm font-medium hover:bg-baba-accent transition-colors w-full"
//         >
//           Continue Shopping
//         </button>

//       </div>

//     </div>
//   );
// }
import { useNavigate, useLocation } from "react-router-dom";
import { CheckCircle, FileText } from "lucide-react";

export default function OrderSuccess() {
  const navigate = useNavigate();
  
  // ✅ 1. Use useLocation to access the hidden state sent from Checkout
  const location = useLocation();
  
  // ✅ 2. Extract the orderNumber. If it's missing, show "N/A"
  const orderNumber = location.state?.orderNumber || "N/A";

  return (
    <div className="min-h-[80vh] flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white p-10 rounded-2xl shadow-lg border border-gray-100 text-center max-w-lg w-full">
        
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-10 h-10 text-green-600" />
        </div>

        <h1 className="font-serif text-3xl text-teal-900 font-bold mb-4">
          Order Confirmed!
        </h1>

        <p className="text-gray-600 mb-8 leading-relaxed">
          Thank you for choosing Baba Textiles. Your order
          {/* ✅ 3. Display the orderNumber here */}
          <span className="font-bold text-teal-700"> #{orderNumber} </span>
           has been placed successfully.
        </p>

        <div className="bg-gray-50 p-4 rounded-lg mb-8 text-left text-sm border border-gray-200">
          <div className="flex items-center gap-2 mb-2 font-semibold text-teal-900">
            <FileText className="w-4 h-4 text-teal-600" /> Order Summary
          </div>

          <div className="flex justify-between text-gray-600 py-1">
            <span>Order ID</span>
            <span className="font-mono">{orderNumber}</span>
          </div>

          <div className="flex justify-between text-gray-600 py-1">
            <span>Status</span>
            <span className="text-orange-600 font-medium">Processing</span>
          </div>
        </div>

        <button
          onClick={() => navigate("/")}
          className="bg-teal-900 text-white px-8 py-3 rounded-sm font-medium hover:bg-teal-800 transition-colors w-full"
        >
          Continue Shopping
        </button>
      </div>
    </div>
  );
}