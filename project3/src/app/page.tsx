'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  TrendingUp,
  Shield,
  Zap,
  Globe,
  ChevronRight,
  Star,
  Check,
  ArrowRight,
  BarChart3,
  Wallet,
  Menu,
  X,
  Eye,
  EyeOff,
  Loader2
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { login as apiLogin, register as apiRegister } from '@/services/authApi';

export default function HomePage() {
  const { isAuthenticated, login: authLogin } = useAuth();
  const router = useRouter();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Auth form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Animated stats
  const [animatedStats, setAnimatedStats] = useState({
    users: 0,
    volume: 0,
    countries: 0,
    uptime: 0
  });

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    // Animate stats on mount
    const duration = 2000;
    const steps = 60;
    const interval = duration / steps;

    const targets = { users: 150000, volume: 2.5, countries: 180, uptime: 99.9 };
    let step = 0;

    const timer = setInterval(() => {
      step++;
      const progress = step / steps;
      setAnimatedStats({
        users: Math.floor(targets.users * progress),
        volume: +(targets.volume * progress).toFixed(1),
        countries: Math.floor(targets.countries * progress),
        uptime: +(targets.uptime * progress).toFixed(1)
      });
      if (step >= steps) clearInterval(timer);
    }, interval);

    return () => clearInterval(timer);
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (authMode === 'register') {
        if (password !== confirmPassword) {
          setError('Mật khẩu xác nhận không khớp');
          setLoading(false);
          return;
        }
        const response = await apiRegister(email, password, name, confirmPassword);
        if (response.success && response.data) {
          // Backend có thể trả về accessToken hoặc token
          const data = response.data as Record<string, unknown>;
          const token = (data.token || data.accessToken || data.access_token) as string;
          const refreshToken = (data.refreshToken || data.refresh_token || '') as string;
          
          // Nếu token nằm trong tokens object
          let finalToken = token;
          let finalRefreshToken = refreshToken;
          if (!finalToken && data.tokens) {
            const tokens = data.tokens as Record<string, string>;
            finalToken = tokens.accessToken || tokens.token;
            finalRefreshToken = tokens.refreshToken || tokens.refresh_token || finalRefreshToken;
          }
          
          if (finalToken) {
            authLogin(response.data.user, finalToken, finalRefreshToken);
            setShowAuthModal(false);
            router.push('/trade');
          } else {
            setError('Lỗi xác thực: Không nhận được token');
          }
        } else {
          setError(response.error?.message || 'Đăng ký thất bại');
        }
      } else {
        const response = await apiLogin(email, password);
        if (response.success && response.data) {
          // Backend có thể trả về accessToken hoặc token
          const data = response.data as Record<string, unknown>;
          const token = (data.token || data.accessToken || data.access_token) as string;
          const refreshToken = (data.refreshToken || data.refresh_token || '') as string;
          
          // Nếu token nằm trong tokens object
          let finalToken = token;
          let finalRefreshToken = refreshToken;
          if (!finalToken && data.tokens) {
            const tokens = data.tokens as Record<string, string>;
            finalToken = tokens.accessToken || tokens.token;
            finalRefreshToken = tokens.refreshToken || tokens.refresh_token || finalRefreshToken;
          }
          
          if (finalToken) {
            authLogin(response.data.user, finalToken, finalRefreshToken);
            setShowAuthModal(false);
            router.push('/trade');
          } else {
            setError('Lỗi xác thực: Không nhận được token');
          }
        } else {
          setError(response.error?.message || 'Đăng nhập thất bại');
        }
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Có lỗi xảy ra';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const openAuth = (mode: 'login' | 'register') => {
    setAuthMode(mode);
    setShowAuthModal(true);
    setError('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setName('');
  };

  const features = [
    {
      icon: <TrendingUp className="w-8 h-8" />,
      title: 'Giao dịch đa dạng',
      description: 'Hỗ trợ hơn 500+ cặp giao dịch với độ thanh khoản cao và spread cạnh tranh.'
    },
    {
      icon: <Shield className="w-8 h-8" />,
      title: 'Bảo mật tối đa',
      description: 'Công nghệ bảo mật đa lớp với 2FA, cold wallet và bảo hiểm tài sản.'
    },
    {
      icon: <Zap className="w-8 h-8" />,
      title: 'Tốc độ siêu nhanh',
      description: 'Xử lý hàng triệu giao dịch mỗi giây với độ trễ cực thấp.'
    },
    {
      icon: <Globe className="w-8 h-8" />,
      title: 'Toàn cầu hóa',
      description: 'Hoạt động tại 180+ quốc gia với hỗ trợ đa ngôn ngữ 24/7.'
    },
    {
      icon: <BarChart3 className="w-8 h-8" />,
      title: 'Công cụ chuyên nghiệp',
      description: 'Biểu đồ TradingView, các loại lệnh nâng cao và API giao dịch.'
    },
    {
      icon: <Wallet className="w-8 h-8" />,
      title: 'Ví an toàn',
      description: 'Quản lý tài sản dễ dàng với ví tích hợp và nạp/rút nhanh chóng.'
    }
  ];

  const testimonials = [
    {
      name: 'Nguyễn Văn An',
      role: 'Trader chuyên nghiệp',
      avatar: 'NA',
      content: 'Đây là sàn giao dịch tốt nhất tôi từng sử dụng. Tốc độ nhanh, phí thấp và bảo mật tuyệt vời.',
      rating: 5
    },
    {
      name: 'Trần Thị Bình',
      role: 'Nhà đầu tư',
      avatar: 'TB',
      content: 'Giao diện thân thiện, dễ sử dụng. Tôi đã giới thiệu cho nhiều bạn bè và họ đều hài lòng.',
      rating: 5
    },
    {
      name: 'Lê Minh Cường',
      role: 'Developer',
      avatar: 'LC',
      content: 'API mạnh mẽ, documentation đầy đủ. Hoàn hảo để xây dựng bot trading.',
      rating: 5
    }
  ];

  const pricingPlans = [
    {
      name: 'Cơ bản',
      price: 'Miễn phí',
      period: '',
      features: [
        'Giao dịch không giới hạn',
        'Phí giao dịch 0.1%',
        'Hỗ trợ email',
        'Bảo mật 2FA',
        'Ví cơ bản'
      ],
      cta: 'Bắt đầu ngay',
      popular: false
    },
    {
      name: 'Pro',
      price: '299,000',
      period: '/tháng',
      features: [
        'Tất cả tính năng Cơ bản',
        'Phí giao dịch 0.05%',
        'Hỗ trợ 24/7',
        'API không giới hạn',
        'Công cụ phân tích nâng cao',
        'Ưu tiên rút tiền'
      ],
      cta: 'Nâng cấp Pro',
      popular: true
    },
    {
      name: 'Enterprise',
      price: 'Liên hệ',
      period: '',
      features: [
        'Tất cả tính năng Pro',
        'Phí tùy chỉnh',
        'Account Manager riêng',
        'SLA 99.99%',
        'Tích hợp tùy chỉnh',
        'Bảo hiểm tài sản'
      ],
      cta: 'Liên hệ',
      popular: false
    }
  ];

  const faqs = [
    {
      question: 'Làm sao để bắt đầu giao dịch?',
      answer: 'Đăng ký tài khoản miễn phí, xác minh email, nạp tiền vào ví và bắt đầu giao dịch ngay.'
    },
    {
      question: 'Phí giao dịch là bao nhiêu?',
      answer: 'Phí giao dịch cơ bản là 0.1%. Nâng cấp lên gói Pro để được giảm còn 0.05%.'
    },
    {
      question: 'Tài sản của tôi có an toàn không?',
      answer: 'Chúng tôi sử dụng cold wallet để lưu trữ 95% tài sản, kết hợp với bảo hiểm và hệ thống bảo mật đa lớp.'
    },
    {
      question: 'Hỗ trợ những phương thức nạp/rút nào?',
      answer: 'Hỗ trợ chuyển khoản ngân hàng, thẻ tín dụng/ghi nợ, và chuyển crypto từ ví ngoài.'
    }
  ];

  return (
    <div className="min-h-screen bg-[#0b0e11] text-white">
      {/* Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-[#0b0e11]/95 backdrop-blur-md shadow-lg' : 'bg-transparent'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-20">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2">
              <div className="w-10 h-10 bg-linear-to-r from-yellow-500 to-orange-500 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-black" />
              </div>
              <span className="text-xl font-bold">CryptoTrade</span>
            </Link>

            {/* Desktop Menu */}
            <div className="hidden lg:flex items-center gap-8">
              <a href="#features" className="text-gray-300 hover:text-white transition-colors">Tính năng</a>
              <a href="#pricing" className="text-gray-300 hover:text-white transition-colors">Bảng giá</a>
              <a href="#testimonials" className="text-gray-300 hover:text-white transition-colors">Đánh giá</a>
              <a href="#faq" className="text-gray-300 hover:text-white transition-colors">FAQ</a>
            </div>

            {/* Auth Buttons */}
            <div className="hidden lg:flex items-center gap-4">
              {isAuthenticated ? (
                <Link
                  href="/trade"
                  className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold px-6 py-2.5 rounded-lg transition-colors"
                >
                  Vào giao dịch
                </Link>
              ) : (
                <>
                  <button
                    onClick={() => openAuth('login')}
                    className="text-gray-300 hover:text-white font-medium transition-colors"
                  >
                    Đăng nhập
                  </button>
                  <button
                    onClick={() => openAuth('register')}
                    className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold px-6 py-2.5 rounded-lg transition-colors"
                  >
                    Đăng ký
                  </button>
                </>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 text-gray-300 hover:text-white"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-[#1e2329] border-t border-[#2b3139]">
            <div className="px-4 py-4 space-y-4">
              <a href="#features" className="block text-gray-300 hover:text-white">Tính năng</a>
              <a href="#pricing" className="block text-gray-300 hover:text-white">Bảng giá</a>
              <a href="#testimonials" className="block text-gray-300 hover:text-white">Đánh giá</a>
              <a href="#faq" className="block text-gray-300 hover:text-white">FAQ</a>
              <div className="pt-4 border-t border-[#2b3139] space-y-3">
                {isAuthenticated ? (
                  <Link
                    href="/trade"
                    className="block bg-yellow-500 hover:bg-yellow-600 text-black font-semibold px-6 py-3 rounded-lg text-center transition-colors"
                  >
                    Vào giao dịch
                  </Link>
                ) : (
                  <>
                    <button
                      onClick={() => { openAuth('login'); setMobileMenuOpen(false); }}
                      className="block w-full text-center text-gray-300 hover:text-white font-medium py-2"
                    >
                      Đăng nhập
                    </button>
                    <button
                      onClick={() => { openAuth('register'); setMobileMenuOpen(false); }}
                      className="block w-full bg-yellow-500 hover:bg-yellow-600 text-black font-semibold px-6 py-3 rounded-lg text-center transition-colors"
                    >
                      Đăng ký
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-32 overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-yellow-500/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl"></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-yellow-500/10 text-yellow-500 px-4 py-2 rounded-full text-sm font-medium mb-6">
              <Zap size={16} />
              <span>Nền tảng giao dịch số 1 Việt Nam</span>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6">
              Giao dịch Crypto
              <span className="bg-linear-to-r from-yellow-500 to-orange-500 bg-clip-text text-transparent"> An toàn </span>
              & Nhanh chóng
            </h1>

            <p className="text-lg md:text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
              Tham gia cùng hơn 150,000+ nhà đầu tư tin tưởng. Giao dịch Bitcoin, Ethereum và hơn 500 loại tiền điện tử với phí thấp nhất thị trường.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <button
                onClick={() => openAuth('register')}
                className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold px-8 py-4 rounded-xl text-lg transition-all hover:scale-105 flex items-center justify-center gap-2"
              >
                Đăng ký miễn phí
                <ArrowRight size={20} />
              </button>
              <Link
                href="/trade"
                className="bg-[#1e2329] hover:bg-[#2b3139] text-white font-semibold px-8 py-4 rounded-xl text-lg transition-colors flex items-center justify-center gap-2"
              >
                Xem bảng giá
                <ChevronRight size={20} />
              </Link>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto">
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-yellow-500">
                  {animatedStats.users.toLocaleString()}+
                </div>
                <div className="text-gray-400 text-sm mt-1">Người dùng</div>
              </div>
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-yellow-500">
                  ${animatedStats.volume}B+
                </div>
                <div className="text-gray-400 text-sm mt-1">Khối lượng GD</div>
              </div>
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-yellow-500">
                  {animatedStats.countries}+
                </div>
                <div className="text-gray-400 text-sm mt-1">Quốc gia</div>
              </div>
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-yellow-500">
                  {animatedStats.uptime}%
                </div>
                <div className="text-gray-400 text-sm mt-1">Uptime</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-[#1e2329]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Tại sao chọn chúng tôi?</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Nền tảng giao dịch với công nghệ tiên tiến, bảo mật hàng đầu và trải nghiệm người dùng tối ưu.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="bg-[#0b0e11] p-6 rounded-2xl border border-[#2b3139] hover:border-yellow-500/50 transition-colors group"
              >
                <div className="w-14 h-14 bg-yellow-500/10 rounded-xl flex items-center justify-center text-yellow-500 mb-4 group-hover:bg-yellow-500/20 transition-colors">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-gray-400">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Bảng giá minh bạch</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Chọn gói phù hợp với nhu cầu của bạn. Nâng cấp hoặc hủy bất cứ lúc nào.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {pricingPlans.map((plan, index) => (
              <div
                key={index}
                className={`relative bg-[#1e2329] rounded-2xl p-8 border ${
                  plan.popular ? 'border-yellow-500' : 'border-[#2b3139]'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yellow-500 text-black text-sm font-semibold px-4 py-1 rounded-full">
                    Phổ biến nhất
                  </div>
                )}
                <h3 className="text-xl font-semibold mb-2">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-3xl font-bold">{plan.price}</span>
                  {plan.period && <span className="text-gray-400">{plan.period}</span>}
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-gray-300">
                      <Check className="w-5 h-5 text-green-500 shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => openAuth('register')}
                  className={`w-full py-3 rounded-xl font-semibold transition-colors ${
                    plan.popular
                      ? 'bg-yellow-500 hover:bg-yellow-600 text-black'
                      : 'bg-[#2b3139] hover:bg-[#363d47] text-white'
                  }`}
                >
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-20 bg-[#1e2329]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Khách hàng nói gì về chúng tôi</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Hàng ngàn nhà đầu tư đã tin tưởng và thành công cùng nền tảng của chúng tôi.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <div key={index} className="bg-[#0b0e11] p-6 rounded-2xl border border-[#2b3139]">
                <div className="flex items-center gap-1 mb-4">
                  {Array.from({ length: testimonial.rating }).map((_, i) => (
                    <Star key={i} className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                  ))}
                </div>
                <p className="text-gray-300 mb-6">&quot;{testimonial.content}&quot;</p>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-linear-to-r from-yellow-500 to-orange-500 rounded-full flex items-center justify-center font-bold text-black">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <div className="font-semibold">{testimonial.name}</div>
                    <div className="text-gray-400 text-sm">{testimonial.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Câu hỏi thường gặp</h2>
            <p className="text-gray-400">
              Tìm câu trả lời cho những thắc mắc phổ biến nhất.
            </p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div key={index} className="bg-[#1e2329] rounded-xl p-6 border border-[#2b3139]">
                <h3 className="font-semibold mb-2">{faq.question}</h3>
                <p className="text-gray-400">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-linear-to-r from-yellow-500/10 to-orange-500/10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Sẵn sàng bắt đầu hành trình đầu tư?
          </h2>
          <p className="text-gray-400 mb-8 max-w-2xl mx-auto">
            Đăng ký ngay hôm nay và nhận 50 USDT tiền thưởng cho giao dịch đầu tiên của bạn.
          </p>
          <button
            onClick={() => openAuth('register')}
            className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold px-8 py-4 rounded-xl text-lg transition-all hover:scale-105 inline-flex items-center gap-2"
          >
            Tạo tài khoản miễn phí
            <ArrowRight size={20} />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-[#1e2329] border-t border-[#2b3139]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <Link href="/" className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 bg-linear-to-r from-yellow-500 to-orange-500 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-black" />
                </div>
                <span className="text-xl font-bold">CryptoTrade</span>
              </Link>
              <p className="text-gray-400 text-sm">
                Nền tảng giao dịch crypto hàng đầu Việt Nam với công nghệ tiên tiến và bảo mật tối đa.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Sản phẩm</h4>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li><a href="#" className="hover:text-white">Giao dịch Spot</a></li>
                <li><a href="#" className="hover:text-white">Giao dịch Margin</a></li>
                <li><a href="#" className="hover:text-white">Staking</a></li>
                <li><a href="#" className="hover:text-white">NFT Marketplace</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Hỗ trợ</h4>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li><a href="#" className="hover:text-white">Trung tâm trợ giúp</a></li>
                <li><a href="#" className="hover:text-white">Hướng dẫn sử dụng</a></li>
                <li><a href="#" className="hover:text-white">API Documentation</a></li>
                <li><a href="#" className="hover:text-white">Phí giao dịch</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Pháp lý</h4>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li><a href="#" className="hover:text-white">Điều khoản sử dụng</a></li>
                <li><a href="#" className="hover:text-white">Chính sách bảo mật</a></li>
                <li><a href="#" className="hover:text-white">Chính sách AML</a></li>
                <li><a href="#" className="hover:text-white">Giấy phép</a></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-[#2b3139] text-center text-gray-400 text-sm">
            © 2024 CryptoTrade. All rights reserved.
          </div>
        </div>
      </footer>

      {/* Auth Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#1e2329] rounded-2xl w-full max-w-md p-8 relative">
            <button
              onClick={() => setShowAuthModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <X size={24} />
            </button>

            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-linear-to-r from-yellow-500 to-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-8 h-8 text-black" />
              </div>
              <h2 className="text-2xl font-bold">
                {authMode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}
              </h2>
              <p className="text-gray-400 mt-1">
                {authMode === 'login'
                  ? 'Chào mừng trở lại!'
                  : 'Bắt đầu hành trình đầu tư của bạn'}
              </p>
            </div>

            <form onSubmit={handleAuth} className="space-y-4">
              {authMode === 'register' && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Họ tên</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-[#0b0e11] border border-[#2b3139] rounded-xl px-4 py-3 text-white focus:border-yellow-500 focus:outline-none"
                    placeholder="Nguyễn Văn A"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-sm text-gray-400 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#0b0e11] border border-[#2b3139] rounded-xl px-4 py-3 text-white focus:border-yellow-500 focus:outline-none"
                  placeholder="you@example.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Mật khẩu</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-[#0b0e11] border border-[#2b3139] rounded-xl px-4 py-3 pr-12 text-white focus:border-yellow-500 focus:outline-none"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              {authMode === 'register' && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Xác nhận mật khẩu</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-[#0b0e11] border border-[#2b3139] rounded-xl px-4 py-3 text-white focus:border-yellow-500 focus:outline-none"
                    placeholder="••••••••"
                    required
                  />
                </div>
              )}

              {error && (
                <div className="bg-red-500/10 border border-red-500/50 rounded-xl px-4 py-3 text-red-500 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-semibold py-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Đang xử lý...
                  </>
                ) : authMode === 'login' ? (
                  'Đăng nhập'
                ) : (
                  'Tạo tài khoản'
                )}
              </button>
            </form>

            <div className="mt-6 text-center text-gray-400 text-sm">
              {authMode === 'login' ? (
                <>
                  Chưa có tài khoản?{' '}
                  <button
                    onClick={() => setAuthMode('register')}
                    className="text-yellow-500 hover:underline"
                  >
                    Đăng ký ngay
                  </button>
                </>
              ) : (
                <>
                  Đã có tài khoản?{' '}
                  <button
                    onClick={() => setAuthMode('login')}
                    className="text-yellow-500 hover:underline"
                  >
                    Đăng nhập
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
