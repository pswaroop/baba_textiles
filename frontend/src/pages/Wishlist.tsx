import { useShop } from "../context/ShopContext";
import ProductCard from "../components/ProductCard";
import { Link } from "react-router-dom";

export default function Wishlist() {
  const { wishlist } = useShop();

  return (
    <div className="bg-baba-background min-h-screen py-16">
      <div className="container mx-auto px-4">

        <h1 className="font-serif text-4xl text-baba-primary mb-10">
          My Wishlist
        </h1>

        {wishlist.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {wishlist.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
              />
            ))}
          </div>
        ) : (
          <div className="text-center mt-20">
            <div className="text-5xl mb-6">❤️</div>

            <p className="text-baba-textdark/60 mb-6 text-lg">
              Your wishlist is empty.
            </p>

            <Link
              to="/shop"
              className="bg-baba-primary text-white px-6 py-3 rounded-sm hover:bg-baba-accent transition font-medium"
            >
              Continue Shopping
            </Link>
          </div>
        )}

      </div>
    </div>
  );
}