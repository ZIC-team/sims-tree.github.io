// Стартовые данные для приложения.
// При первом запуске они подхватятся, дальше всё хранится в localStorage.

window.DEFAULT_STATE = {
  trees: [
    {
      id: "t_main",
      name: "Основное древо",
      color: "#38bdf8",
      description: "Стартовое древо для ваших симов."
    }
  ],
  persons: [
    // сюда можно руками дописать стартовых персонажей, например:
    // {
    //   id: "p_bella",
    //   name: "Белла Гот",
    //   home: "Виллоу Крик",
    //   birthDate: "1990-01-01",
    //   deathDate: "",
    //   photoUrl: "images/bella.png",
    //   notes: "Классическая симка.",
    //   trees: ["t_main"],
    //   relations: []
    // }
  ],
  activeTreeId: "t_main",
  selectedPersonId: null
};
