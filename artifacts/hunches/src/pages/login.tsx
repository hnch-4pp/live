import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";

export default function Login() {
  const { t } = useTranslation();

  return (
    <Layout>
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-card border border-border rounded-xl p-8 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-accent"></div>

            <div className="text-center mb-8">
              <div className="w-12 h-12 rounded bg-primary/10 flex items-center justify-center mx-auto mb-4 border border-primary/20">
                <div className="w-4 h-4 bg-primary rounded-full shadow-[0_0_15px_rgba(var(--primary),0.8)]" />
              </div>
              <h1 className="font-display text-2xl font-bold text-foreground">{t("welcome_back")}</h1>
              <p className="text-muted-foreground text-sm mt-2">{t("sign_in_sub")}</p>
            </div>

            <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
              <div className="space-y-2">
                <Label htmlFor="email">{t("email")}</Label>
                <Input id="email" type="email" placeholder="name@example.com" className="bg-background" />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">{t("password")}</Label>
                  <a href="#" className="text-xs text-primary hover:underline">{t("forgot_password")}</a>
                </div>
                <Input id="password" type="password" placeholder="••••••••" className="bg-background" />
              </div>

              <Button className="w-full bg-primary text-primary-foreground font-semibold" size="lg">
                {t("sign_in")}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-muted-foreground">
              {t("no_account")}{" "}
              <Link href="/signup" className="text-primary hover:underline font-medium">
                {t("nav_signup")}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
