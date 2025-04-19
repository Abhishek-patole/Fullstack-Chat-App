const AuthImagePattern = ({ title, subtitle }) => {
  const colors = [
    "bg-purple-600",   
    "bg-purple-500",   
    "bg-purple-700",   
    "bg-purple-400",   
    "bg-purple-800",   
    "bg-purple-300",   
    "bg-purple-900",  
    "bg-purple-200",   
    "bg-purple-100",   
  ];

  return (
    <div className="hidden lg:flex items-center justify-center bg-base-200 p-12">
      <div className="max-w-md text-center">
        <div className="grid grid-cols-3 gap-3 mb-8">
          {[...Array(9)].map((_, i) => (
            <div
              key={i}
              className={`aspect-square rounded-2xl ${colors[i % colors.length]} transition-all hover:scale-105 ${
                i % 2 === 0 ? "animate-pulse" : ""
              }`}
            />
          ))}
        </div>
        <h2 className="text-2xl font-bold mb-4 text-base-content">{title}</h2>
        <p className="text-base-content/60">{subtitle}</p>
      </div>
    </div>
  );
};

export default AuthImagePattern;
