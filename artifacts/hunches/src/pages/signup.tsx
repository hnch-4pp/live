import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";

export default function Signup() {
  const { t } = useTranslation();

  return (
    <Layout>
      <div className="flex-1 flex items-center justify-center p-4 py-12">
        <div className="w-full max-w-md">
          <div className="bg-card border border-border rounded-xl p-8 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-accent to-primary"></div>

            <div className="text-center mb-8">
              <h1 className="font-display text-2xl font-bold text-foreground">{t("create_account")}</h1>
              <p className="text-muted-foreground text-sm mt-2">{t("signup_sub")}</p>
            </div>

            <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
              <div className="space-y-2">
                <Label htmlFor="name">{t("display_name")}</Label>
                <Input id="name" placeholder={t("display_name_ph")} className="bg-background" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">{t("email")}</Label>
                <Input id="email" type="email" placeholder="name@example.com" className="bg-background" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">{t("password")}</Label>
                <Input id="password" type="password" placeholder={t("create_pw_ph")} className="bg-background" />
              </div>

              <div className="pt-2 text-xs text-muted-foreground">
                {t("agree_text")}{" "}
                <Link href="/terms" className="text-primary hover:underline">{t("terms_of_service")}</Link>
                {" "}{t("and")}{" "}
                <Link href="/privacy" className="text-primary hover:underline">{t("privacy_policy_label")}</Link>.
              </div>

              <Button className="w-full bg-accent text-accent-foreground font-semibold hover:bg-accent/90" size="lg">
                {t("create_account_btn")}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm text-muted-foreground">
              {t("already_account")}{" "}
              <Link href="/login" className="text-primary hover:underline font-medium">
                {t("log_in")}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
