# Ruby 4.0 removed String#taint / Object#untaint; Liquid 4 still calls them.
# This no-op shim makes `bundle exec jekyll` work locally on modern Rubies.
# GitHub Pages builds use older Ruby and do NOT need this. Load it with:
#   RUBYOPT="-r./scripts/ruby4-compat.rb" bundle exec jekyll serve
if RUBY_VERSION.to_f >= 3.2
  unless Object.method_defined?(:tainted?)
    class Object
      def tainted?; false; end
      def taint; self; end
      def untaint; self; end
    end
  end
end
