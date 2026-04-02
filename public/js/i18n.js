(function () {
    const SUPPORTED = ['en', 'fr', 'pt'];

    const DICT = {
        en: {
            'nav.overview': 'Overview',
            'nav.classes': 'Classes',
            'nav.attendance': 'Attendance',
            'nav.map': 'Map',
            'nav.schedule': 'Schedule',
            'nav.analytics': 'Analytics',
            'dashboard.welcome': 'Welcome back',
            'dashboard.quickActions': 'Quick Actions',
            'dashboard.viewSchedule': 'View Schedule',
            'dashboard.myReports': 'My Reports',
            'dashboard.startCheckIn': 'Start Check-In',
            'dashboard.viewReports': 'View Reports',
            'dashboard.upcomingClasses': 'Upcoming Classes',
            'dashboard.noClassesToday': 'No Classes Today',
            'dashboard.enjoyFreeDay': 'Enjoy your free day!',
            'dashboard.present': 'Present',
            'dashboard.startingSoon': 'starting soon',
            'dashboard.inApprox': 'In ~',
            'dashboard.minutes': 'min',
            'admin.systemAdministration': 'System Administration',
            'lecturer.generateQR': 'Generate QR',
            'lecturer.manualEntry': 'Manual Entry',
            'lecturer.manageStudents': 'Manage Students / Reps',
            'lecturer.currentlyTeaching': 'Currently Teaching',
            'lecturer.nextClass': 'Next Class',
            'lecturer.startingIn': 'Starting in ~',
            'lecturer.yearLabel': 'Year',
            'lecturer.studentsLabel': 'Students',
            'lecturer.noMoreClassesToday': 'No More Classes Today',
            'lecturer.nextClassOn': 'Your next class is on',
            'lecturer.sessionsPerWeek': 'sessions/week',
            'profile.lecturerRole': 'Lecturer',
            'profile.fullName': 'Full Name',
            'profile.staffId': 'Staff ID',
            'profile.email': 'Email',
            'profile.department': 'Department',
            'profile.phone': 'Phone',
            'profile.courses': 'Courses',
            'profile.sessionsPerWeek': 'Sessions/Week',
            'profile.manageSchedule': 'Manage Schedule',
            'profile.loadingClasses': 'Loading classes...',
            'profile.editClassSchedule': 'Edit Class Schedule',
            'profile.day': 'Day',
            'profile.time': 'Time',
            'profile.room': 'Room',
            'profile.saveChanges': 'Save Changes',
            'profile.edit': 'Edit',
            'profile.noCoursesAssigned': 'No courses assigned.',
            'profile.profileSaved': 'Profile saved successfully!',
            'profile.scheduleSaved': 'Schedule updated successfully!',
            'profile.failedUpdate': 'Failed to update class. Try again.',
            'profile.saving': 'Saving...',
            'profile.loading': 'Loading...',
            'profile.selectLanguage.en': 'English',
            'profile.selectLanguage.fr': 'Francais',
            'profile.selectLanguage.pt': 'Portugues',
            'profile.monday': 'Monday',
            'profile.tuesday': 'Tuesday',
            'profile.wednesday': 'Wednesday',
            'profile.thursday': 'Thursday',
            'profile.friday': 'Friday',
            'student.schedule.title': 'Weekly Schedule',
            'student.schedule.subtitle': 'Your academic calendar & attendance status',
            'student.reports.title': 'Attendance Reports',
            'student.reports.breakdown': 'Course Breakdown',
            'lecturer.classes.title': 'My Classes',
            'lecturer.schedule.title': 'My Teaching Schedule',
            'lecturer.reports.title': 'Attendance Analytics',
            'profile.title': 'My Profile',
            'profile.subtitle': 'Manage your account settings',
            'profile.language': 'Preferred Language',
            'profile.save': 'Save Changes',
            'map.title': 'Campus Map',
            'map.subtitle': 'Navigation powered by OpenStreetMap',
            'map.locations': 'Key Locations',
            'map.directions': 'Get Directions',
            'map.navigate': 'Navigate',
            'map.detect': 'Detect My Building',
            'map.liveStart': 'Start Live Tracking',
            'map.liveStop': 'Stop Live Tracking',
            'map.offline': 'OFFLINE',
            'map.next': 'Next:',
            'map.loading': 'Loading...',
            'map.currentLocation': 'Current Location (GPS)',
            'map.selectDestination': 'Select destination',
            'map.venue.ict.title': 'ICT Complex',
            'map.venue.ict.desc': 'Mai Mugabe, Labs',
            'map.venue.library.title': 'Yokyo Library',
            'map.venue.library.desc': 'Main Library',
            'map.venue.chapel.title': 'Kwame Nkrumah Chapel',
            'map.venue.chapel.desc': 'Assembly Hall',
            'map.venue.halls.title': 'Halls of Residence',
            'map.venue.halls.desc': 'Student Housing',
            'map.venue.union.title': 'Student Union',
            'map.venue.union.desc': 'Cafeteria & Shops',
            'map.alert.locationUnsupported': 'Geolocation is not supported in this browser.',
            'map.alert.detecting': 'Detecting...',
            'map.alert.unmapped': 'Could not match your location to a mapped building.',
            'map.alert.nearest': 'Nearest mapped building:',
            'map.alert.permission': 'Could not read your GPS location. Check location permissions.',
            'map.alert.selectDestination': 'Please select a destination.',
            'map.alert.selectStart': 'Geolocation not supported. Please select a start point.',
            'map.alert.locationDenied': 'Could not get your location. Please select a starting point manually.',
            'map.alert.startTracking': 'Select a destination first.',
            'map.alert.liveTrackingFailed': 'Live tracking failed. Check your location permissions.',
            'help.button': 'Help',
            'attendance.markTitle': 'Mark Attendance',
            'attendance.markSubtitle': 'Choose a live class, then scan or enter the lecturer code.',
            'attendance.liveClasses': 'Live Classes',
            'attendance.enterCode': '6-Digit Code',
            'attendance.verify': 'Verify Code',
            'attendance.refresh': 'Refresh Live Classes',
            'attendance.liveTitle': 'Current Live Classes',
            'attendance.liveSubtitle': 'Only classes that are running now or starting soon are shown here.',
            'attendance.verifyIdentity': 'Verify your identity',
            'attendance.verifyIdentityCopy': 'This device is not recognized. Use device biometrics first; if unavailable, use a live selfie and student ID check.',
            'attendance.useBiometrics': 'Use biometrics on this phone',
            'attendance.useSelfie': 'Live selfie verification',
            'attendance.manualFallback': 'See lecturer for manual add',
            'attendance.noLive': 'No live classes right now',
            'attendance.noLiveHint': 'Try again when class starts or select a class from your schedule.',
            'attendance.noClassesOption': 'No live classes available',
            'attendance.loading': 'Loading live classes...',
            'attendance.liveLoaded': 'Live classes loaded.',
            'attendance.selectClassFirst': 'Please choose a live class first.',
            'attendance.invalidCode': 'Enter a valid 6-digit code.',
            'attendance.verifying': 'Verifying...',
            'attendance.verifyRequired': 'This device needs identity verification before continuing.',
            'attendance.success': 'Attendance recorded successfully.',
            'attendance.invalidOrExpired': 'Invalid or expired code.',
            'attendance.manualFallbackInfo': 'Please see the lecturer so they can add you manually.',
            'attendance.selfieTitle': 'Capture a live selfie',
            'attendance.selfieSubtitle': 'The live image is used only for this verification step and is not saved.',
            'attendance.cameraUnavailable': 'Camera access is unavailable on this device.',
            'attendance.verified': 'Identity verified. You can continue with the code.',
            'attendance.help1': '1. Choose your live class from the list.',
            'attendance.help2': '2. Enter the lecturer code or scan the QR code.',
            'attendance.help3': '3. If this is a new device, verify with biometrics first.',
            'attendance.help4': '4. If biometrics are unavailable, use the live selfie fallback or ask the lecturer to add you manually.',
            'attendance.sessionMode': 'Session mode'
        },
        fr: {
            'nav.overview': 'Apercu',
            'nav.classes': 'Cours',
            'nav.attendance': 'Presence',
            'nav.map': 'Carte',
            'nav.schedule': 'Horaire',
            'nav.analytics': 'Analytique',
            'dashboard.welcome': 'Bon retour',
            'dashboard.quickActions': 'Actions rapides',
            'dashboard.viewSchedule': 'Voir l\'horaire',
            'dashboard.myReports': 'Mes rapports',
            'dashboard.startCheckIn': 'Commencer la presence',
            'dashboard.viewReports': 'Voir les rapports',
            'dashboard.upcomingClasses': 'Cours a venir',
            'dashboard.noClassesToday': 'Aucun cours aujourdhui',
            'dashboard.enjoyFreeDay': 'Profitez de votre journee libre !',
            'dashboard.present': 'Present',
            'dashboard.startingSoon': 'commence bientot',
            'dashboard.inApprox': 'Dans ~',
            'dashboard.minutes': 'min',
            'admin.systemAdministration': 'Administration du systeme',
            'lecturer.generateQR': 'Generer le QR',
            'lecturer.manualEntry': 'Saisie manuelle',
            'lecturer.manageStudents': 'Gerer les etudiants / representants',
            'lecturer.currentlyTeaching': 'En cours denseignement',
            'lecturer.nextClass': 'Prochain cours',
            'lecturer.startingIn': 'Debut dans ~',
            'lecturer.yearLabel': 'Annee',
            'lecturer.studentsLabel': 'Etudiants',
            'lecturer.noMoreClassesToday': 'Plus de cours aujourdhui',
            'lecturer.nextClassOn': 'Votre prochain cours est',
            'lecturer.sessionsPerWeek': 'sessions/semaine',
            'student.schedule.title': 'Horaire hebdomadaire',
            'student.schedule.subtitle': 'Votre calendrier academique et etat de presence',
            'student.reports.title': 'Rapports de presence',
            'student.reports.breakdown': 'Repartition des cours',
            'lecturer.classes.title': 'Mes cours',
            'lecturer.schedule.title': 'Mon horaire d\'enseignement',
            'lecturer.reports.title': 'Analytique de presence',
            'profile.title': 'Mon profil',
            'profile.subtitle': 'Gerer les parametres de votre compte',
            'profile.language': 'Langue preferee',
            'profile.save': 'Enregistrer les modifications',
            'map.title': 'Carte du campus',
            'map.subtitle': 'Navigation alimentee par OpenStreetMap',
            'map.locations': 'Lieux cles',
            'map.directions': 'Obtenir un itineraire',
            'map.navigate': 'Naviguer',
            'map.detect': 'Detecter mon batiment',
            'map.liveStart': 'Demarrer le suivi en direct',
            'map.liveStop': 'Arreter le suivi en direct',
            'map.offline': 'HORS LIGNE',
            'map.next': 'Suivant:',
            'map.loading': 'Chargement...',
            'map.currentLocation': 'Position actuelle (GPS)',
            'map.selectDestination': 'Choisir la destination',
            'map.venue.ict.title': 'Complexe ICT',
            'map.venue.ict.desc': 'Mai Mugabe, laboratoires',
            'map.venue.library.title': 'Bibliotheque Yokyo',
            'map.venue.library.desc': 'Bibliotheque principale',
            'map.venue.chapel.title': 'Chapelle Kwame Nkrumah',
            'map.venue.chapel.desc': 'Salle d\'assemblee',
            'map.venue.halls.title': 'Résidences universitaires',
            'map.venue.halls.desc': 'Logement des etudiants',
            'map.venue.union.title': 'Union des etudiants',
            'map.venue.union.desc': 'Cafeteria et boutiques',
            'map.alert.locationUnsupported': 'La geolocalisation nest pas prise en charge par ce navigateur.',
            'map.alert.detecting': 'Detection...',
            'map.alert.unmapped': 'Impossible de faire correspondre votre position a un batiment de la carte.',
            'map.alert.nearest': 'Batiment cartographie le plus proche:',
            'map.alert.permission': 'Impossible de lire votre position GPS. Verifiez les autorisations de localisation.',
            'map.alert.selectDestination': 'Veuillez selectionner une destination.',
            'map.alert.selectStart': 'Geolocalisation non prise en charge. Veuillez choisir un point de depart.',
            'map.alert.locationDenied': 'Impossible dobtenir votre position. Veuillez choisir un point de depart manuellement.',
            'map.alert.startTracking': 'Choisissez d\'abord une destination.',
            'map.alert.liveTrackingFailed': 'Le suivi en direct a echoue. Verifiez vos autorisations de localisation.',
            'help.button': 'Aide',
            'attendance.markTitle': 'Marquer la presence',
            'attendance.markSubtitle': 'Choisissez un cours en direct, puis scannez ou saisissez le code du professeur.',
            'attendance.liveClasses': 'Cours en direct',
            'attendance.enterCode': 'Code a 6 chiffres',
            'attendance.verify': 'Verifier le code',
            'attendance.refresh': 'Actualiser les cours',
            'attendance.liveTitle': 'Cours en direct actuels',
            'attendance.liveSubtitle': 'Seuls les cours en cours ou sur le point de commencer sont affiches ici.',
            'attendance.verifyIdentity': 'Verifier votre identite',
            'attendance.verifyIdentityCopy': 'Cet appareil nest pas reconnu. Utilisez dabord la biometrie de lappareil; sinon, utilisez un selfie en direct et la verification de la carte detudiant.',
            'attendance.useBiometrics': 'Utiliser la biometrie sur ce telephone',
            'attendance.useSelfie': 'Verification par selfie en direct',
            'attendance.manualFallback': 'Voir le professeur pour ajout manuel',
            'attendance.noLive': 'Aucun cours en direct pour le moment',
            'attendance.noLiveHint': 'Reessayez au debut du cours ou choisissez un cours dans votre emploi du temps.',
            'attendance.noClassesOption': 'Aucun cours en direct disponible',
            'attendance.loading': 'Chargement des cours en direct...',
            'attendance.liveLoaded': 'Cours en direct charges.',
            'attendance.selectClassFirst': 'Veuillez dabord choisir un cours en direct.',
            'attendance.invalidCode': 'Entrez un code valide a 6 chiffres.',
            'attendance.verifying': 'Verification...',
            'attendance.verifyRequired': 'Cet appareil doit verifier son identite avant de continuer.',
            'attendance.success': 'Presence enregistree avec succes.',
            'attendance.invalidOrExpired': 'Code invalide ou expire.',
            'attendance.manualFallbackInfo': 'Veuillez voir le professeur afin quil vous ajoute manuellement.',
            'attendance.selfieTitle': 'Prendre un selfie en direct',
            'attendance.selfieSubtitle': 'Limage en direct nest utilisee que pour cette verification et nest pas enregistree.',
            'attendance.cameraUnavailable': 'Lacces a la camera nest pas disponible sur cet appareil.',
            'attendance.verified': 'Identite verifiee. Vous pouvez continuer avec le code.',
            'attendance.help1': '1. Choisissez votre cours en direct dans la liste.',
            'attendance.help2': '2. Entrez le code du professeur ou scannez le QR code.',
            'attendance.help3': '3. Si cest un nouvel appareil, utilisez dabord la biometrie.',
            'attendance.help4': '4. Si la biometrie nest pas disponible, utilisez le selfie en direct ou demandez un ajout manuel au professeur.',
            'attendance.sessionMode': 'Mode de session'
        },
        pt: {
            'nav.overview': 'Visao geral',
            'nav.classes': 'Aulas',
            'nav.attendance': 'Presenca',
            'nav.map': 'Mapa',
            'nav.schedule': 'Horario',
            'nav.analytics': 'Analitica',
            'dashboard.welcome': 'Bem-vindo de volta',
            'dashboard.quickActions': 'Acoes rapidas',
            'dashboard.viewSchedule': 'Ver horario',
            'dashboard.myReports': 'Meus relatorios',
            'dashboard.startCheckIn': 'Iniciar presenca',
            'dashboard.viewReports': 'Ver relatorios',
            'dashboard.upcomingClasses': 'Aulas proximas',
            'dashboard.noClassesToday': 'Sem aulas hoje',
            'dashboard.enjoyFreeDay': 'Aproveite seu dia livre!',
            'dashboard.present': 'Presente',
            'dashboard.startingSoon': 'comeca em breve',
            'dashboard.inApprox': 'Em ~',
            'dashboard.minutes': 'min',
            'admin.systemAdministration': 'Administracao do sistema',
            'lecturer.generateQR': 'Gerar QR',
            'lecturer.manualEntry': 'Entrada manual',
            'lecturer.manageStudents': 'Gerenciar estudantes / representantes',
            'lecturer.currentlyTeaching': 'Lecionando agora',
            'lecturer.nextClass': 'Proxima aula',
            'lecturer.startingIn': 'Comeca em ~',
            'lecturer.yearLabel': 'Ano',
            'lecturer.studentsLabel': 'Estudantes',
            'lecturer.noMoreClassesToday': 'Sem mais aulas hoje',
            'lecturer.nextClassOn': 'Sua proxima aula e',
            'lecturer.sessionsPerWeek': 'sessoes/semana',
            'profile.lecturerRole': 'Professor',
            'profile.fullName': 'Nome completo',
            'profile.staffId': 'ID do funcionario',
            'profile.email': 'Email',
            'profile.department': 'Departamento',
            'profile.phone': 'Telefone',
            'profile.courses': 'Disciplinas',
            'profile.sessionsPerWeek': 'Sessoes/semana',
            'profile.manageSchedule': 'Gerenciar horario',
            'profile.loadingClasses': 'Carregando turmas...',
            'profile.editClassSchedule': 'Editar horario da disciplina',
            'profile.day': 'Dia',
            'profile.time': 'Horario',
            'profile.room': 'Sala',
            'profile.saveChanges': 'Salvar alteracoes',
            'profile.edit': 'Editar',
            'profile.noCoursesAssigned': 'Nenhuma disciplina atribuida.',
            'profile.profileSaved': 'Perfil salvo com sucesso!',
            'profile.scheduleSaved': 'Horario atualizado com sucesso!',
            'profile.failedUpdate': 'Falha ao atualizar a disciplina. Tente novamente.',
            'profile.saving': 'Salvando...',
            'profile.loading': 'Carregando...',
            'profile.selectLanguage.en': 'Ingles',
            'profile.selectLanguage.fr': 'Francais',
            'profile.selectLanguage.pt': 'Portugues',
            'profile.monday': 'Segunda-feira',
            'profile.tuesday': 'Terca-feira',
            'profile.wednesday': 'Quarta-feira',
            'profile.thursday': 'Quinta-feira',
            'profile.friday': 'Sexta-feira',
            'student.schedule.title': 'Horario semanal',
            'student.schedule.subtitle': 'Seu calendario academico e status de presenca',
            'student.reports.title': 'Relatorios de presenca',
            'student.reports.breakdown': 'Detalhamento por disciplina',
            'lecturer.classes.title': 'Minhas disciplinas',
            'lecturer.schedule.title': 'Meu horario de ensino',
            'lecturer.reports.title': 'Analitica de presenca',
            'profile.title': 'Meu perfil',
            'profile.subtitle': 'Gerencie as configuracoes da sua conta',
            'profile.language': 'Idioma preferido',
            'profile.save': 'Salvar alteracoes',
            'map.title': 'Mapa do campus',
            'map.subtitle': 'Navegacao com OpenStreetMap',
            'map.locations': 'Locais principais',
            'map.directions': 'Obter direcoes',
            'map.navigate': 'Navegar',
            'map.detect': 'Detectar meu edificio',
            'map.liveStart': 'Iniciar rastreamento ao vivo',
            'map.liveStop': 'Parar rastreamento ao vivo',
            'map.offline': 'OFFLINE',
            'map.next': 'Próximo:',
            'map.loading': 'Carregando...',
            'map.currentLocation': 'Local atual (GPS)',
            'map.selectDestination': 'Selecione o destino',
            'map.venue.ict.title': 'Complexo ICT',
            'map.venue.ict.desc': 'Mai Mugabe, laboratorios',
            'map.venue.library.title': 'Biblioteca Yokyo',
            'map.venue.library.desc': 'Biblioteca principal',
            'map.venue.chapel.title': 'Capela Kwame Nkrumah',
            'map.venue.chapel.desc': 'Sala de assembleia',
            'map.venue.halls.title': 'Residencias estudantis',
            'map.venue.halls.desc': 'Alojamento estudantil',
            'map.venue.union.title': 'Uniao estudantil',
            'map.venue.union.desc': 'Cafeteria e lojas',
            'map.alert.locationUnsupported': 'A geolocalizacao nao e suportada neste navegador.',
            'map.alert.detecting': 'Detectando...',
            'map.alert.unmapped': 'Nao foi possivel associar sua localizacao a um edificio mapeado.',
            'map.alert.nearest': 'Edificio mapeado mais proximo:',
            'map.alert.permission': 'Nao foi possivel ler sua localizacao GPS. Verifique as permissoes.',
            'map.alert.selectDestination': 'Selecione um destino.',
            'map.alert.selectStart': 'Geolocalizacao nao suportada. Selecione um ponto de partida.',
            'map.alert.locationDenied': 'Nao foi possivel obter sua localizacao. Selecione um ponto de partida manualmente.',
            'map.alert.startTracking': 'Selecione um destino primeiro.',
            'map.alert.liveTrackingFailed': 'O rastreamento ao vivo falhou. Verifique as permissoes de localizacao.',
            'help.button': 'Ajuda',
            'attendance.markTitle': 'Marcar presenca',
            'attendance.markSubtitle': 'Escolha uma aula ao vivo e depois escaneie ou digite o codigo do professor.',
            'attendance.liveClasses': 'Aulas ao vivo',
            'attendance.enterCode': 'Codigo de 6 digitos',
            'attendance.verify': 'Verificar codigo',
            'attendance.refresh': 'Atualizar aulas ao vivo',
            'attendance.liveTitle': 'Aulas ao vivo atuais',
            'attendance.liveSubtitle': 'Somente as aulas em andamento ou prestes a comecar sao mostradas aqui.',
            'attendance.verifyIdentity': 'Verifique sua identidade',
            'attendance.verifyIdentityCopy': 'Este dispositivo nao e reconhecido. Use primeiro a biometria do aparelho; se nao houver, use uma selfie ao vivo e a verificacao do ID do aluno.',
            'attendance.useBiometrics': 'Usar biometria neste telefone',
            'attendance.useSelfie': 'Verificacao por selfie ao vivo',
            'attendance.manualFallback': 'Ver o professor para adicionar manualmente',
            'attendance.noLive': 'Nenhuma aula ao vivo agora',
            'attendance.noLiveHint': 'Tente novamente quando a aula comecar ou selecione uma aula na sua agenda.',
            'attendance.noClassesOption': 'Nenhuma aula ao vivo disponivel',
            'attendance.loading': 'Carregando aulas ao vivo...',
            'attendance.liveLoaded': 'Aulas ao vivo carregadas.',
            'attendance.selectClassFirst': 'Escolha primeiro uma aula ao vivo.',
            'attendance.invalidCode': 'Digite um codigo valido de 6 digitos.',
            'attendance.verifying': 'Verificando...',
            'attendance.verifyRequired': 'Este dispositivo precisa verificar sua identidade antes de continuar.',
            'attendance.success': 'Presenca registrada com sucesso.',
            'attendance.invalidOrExpired': 'Codigo invalido ou expirado.',
            'attendance.manualFallbackInfo': 'Veja o professor para que ele o adicione manualmente.',
            'attendance.selfieTitle': 'Capture uma selfie ao vivo',
            'attendance.selfieSubtitle': 'A imagem ao vivo so e usada para esta verificacao e nao e armazenada.',
            'attendance.cameraUnavailable': 'O acesso a camera nao esta disponivel neste dispositivo.',
            'attendance.verified': 'Identidade verificada. Voce pode continuar com o codigo.',
            'attendance.help1': '1. Escolha sua aula ao vivo na lista.',
            'attendance.help2': '2. Digite o codigo do professor ou escaneie o QR code.',
            'attendance.help3': '3. Se for um novo dispositivo, verifique primeiro com biometria.',
            'attendance.help4': '4. Se a biometria nao estiver disponivel, use a selfie ao vivo ou peça ao professor a adicao manual.',
            'attendance.sessionMode': 'Modo de sessao'
        }
    };

    const PAGE_TITLES = {
        'My Profile': { en: 'My Profile', fr: 'Mon profil', pt: 'Meu perfil' },
        'Attendance Reports': { en: 'Attendance Reports', fr: 'Rapports de presence', pt: 'Relatorios de presenca' },
        'Weekly Schedule': { en: 'Weekly Schedule', fr: 'Horaire hebdomadaire', pt: 'Horario semanal' },
        'Campus Map': { en: 'Campus Map', fr: 'Carte du campus', pt: 'Mapa do campus' },
        'My Classes': { en: 'My Classes', fr: 'Mes cours', pt: 'Minhas disciplinas' },
        'My Teaching Schedule': { en: 'My Teaching Schedule', fr: 'Mon horaire d\'enseignement', pt: 'Meu horario de ensino' },
        'Attendance Analytics': { en: 'Attendance Analytics', fr: 'Analytique de presence', pt: 'Analitica de presenca' },
        'System Administration': { en: 'System Administration', fr: 'Administration du systeme', pt: 'Administracao do sistema' },
        'Announcements - UPath': { en: 'Announcements - UPath', fr: 'Annonces - UPath', pt: 'Anuncios - UPath' },
        'Admin Dashboard - UPath': { en: 'Admin Dashboard - UPath', fr: 'Tableau de bord admin - UPath', pt: 'Painel do administrador - UPath' }
    };

    const TEXT_TRANSLATIONS = {
        'Overview': { fr: 'Apercu', pt: 'Visao geral' },
        'Classes': { fr: 'Cours', pt: 'Aulas' },
        'Attendance': { fr: 'Presence', pt: 'Presenca' },
        'Map': { fr: 'Carte', pt: 'Mapa' },
        'Schedule': { fr: 'Horaire', pt: 'Horario' },
        'Analytics': { fr: 'Analytique', pt: 'Analitica' },
        'Quick Actions': { fr: 'Actions rapides', pt: 'Acoes rapidas' },
        'Start Check-In': { fr: 'Commencer la presence', pt: 'Iniciar presenca' },
        'View Reports': { fr: 'Voir les rapports', pt: 'Ver relatorios' },
        'Campus Map': { fr: 'Carte du campus', pt: 'Mapa do campus' },
        'My Profile': { fr: 'Mon profil', pt: 'Meu perfil' },
        'Manage your account settings': { fr: 'Gerer les parametres de votre compte', pt: 'Gerencie as configuracoes da sua conta' },
        'My Classes': { fr: 'Mes cours', pt: 'Minhas disciplinas' },
        'My Teaching Schedule': { fr: 'Mon horaire d\'enseignement', pt: 'Meu horario de ensino' },
        'Attendance Reports': { fr: 'Rapports de presence', pt: 'Relatorios de presenca' },
        'Attendance Analytics': { fr: 'Analytique de presence', pt: 'Analitica de presenca' },
        'System Administration': { fr: 'Administration du systeme', pt: 'Administracao do sistema' },
        'User Management': { fr: 'Gestion des utilisateurs', pt: 'Gestao de usuarios' },
        'Timetable Management': { fr: 'Gestion de lhoraire', pt: 'Gestao de horario' },
        'Map & Route Creation': { fr: 'Carte et creation de trajets', pt: 'Mapa e criacao de rotas' },
        'Upload New Timetable': { fr: 'Televerser un nouvel horaire', pt: 'Enviar novo horario' },
        'Current Timetable Status': { fr: 'Etat actuel de lhoraire', pt: 'Status atual do horario' },
        'Create New User': { fr: 'Creer un nouvel utilisateur', pt: 'Criar novo usuario' },
        'ID Number': { fr: 'Numero didentification', pt: 'Numero de identificacao' },
        'Full Name': { fr: 'Nom complet', pt: 'Nome completo' },
        'Email': { fr: 'Courriel', pt: 'Email' },
        'Password': { fr: 'Mot de passe', pt: 'Senha' },
        'Role': { fr: 'Role', pt: 'Cargo' },
        'Year': { fr: 'Annee', pt: 'Ano' },
        'Program': { fr: 'Programme', pt: 'Programa' },
        'Department': { fr: 'Departement', pt: 'Departamento' },
        'College': { fr: 'College', pt: 'Faculdade' },
        'N/A': { fr: 'N/D', pt: 'N/A' },
        'e.g. 250001': { fr: 'p. ex. 250001', pt: 'ex. 250001' },
        'e.g. John Doe': { fr: 'p. ex. John Doe', pt: 'ex. John Doe' },
        'Optional': { fr: 'Facultatif', pt: 'Opcional' },
        'Set password': { fr: 'Definir le mot de passe', pt: 'Definir senha' },
        'e.g. Computer Sciences': { fr: 'p. ex. Sciences informatiques', pt: 'ex. Ciencias da computacao' },
        'e.g. Computing': { fr: 'p. ex. Informatique', pt: 'ex. Computacao' },
        'e.g. CEAS': { fr: 'p. ex. CEAS', pt: 'ex. CEAS' },
        'Users': { fr: 'Utilisateurs', pt: 'Usuarios' },
        'Timetable': { fr: 'Horaire', pt: 'Horario' },
        'Map & Routes': { fr: 'Carte et itineraires', pt: 'Mapa e rotas' },
        'Upload Timetable': { fr: 'Televerser l\'horaire', pt: 'Enviar horario' },
        'Data Quality': { fr: 'Qualite des donnees', pt: 'Qualidade dos dados' },
        'Dup. Students': { fr: 'Etudiants dupliques', pt: 'Estudantes duplicados' },
        'AI Management': { fr: 'Gestion IA', pt: 'Gerenciamento de IA' },
        'Security': { fr: 'Securite', pt: 'Seguranca' },
        'Create User': { fr: 'Creer un utilisateur', pt: 'Criar usuario' },
        'Open Full Map': { fr: 'Ouvrir la carte complete', pt: 'Abrir mapa completo' },
        'Map & Route Creation': { fr: 'Carte et creation de trajets', pt: 'Mapa e criacao de rotas' },
        'Use the campus map to draw and copy new routes. Live tracking will keep using the saved route network.': { fr: 'Utilisez la carte du campus pour dessiner et copier de nouveaux trajets. Le suivi en direct continuera dutiliser le reseau de trajets enregistre.', pt: 'Use o mapa do campus para desenhar e copiar novas rotas. O rastreamento ao vivo continuara usando a rede de rotas salva.' },
        'This tab loads the student map in admin mode. The route recorder is available here only, so you can create or copy paths without exposing the recorder on the student dashboard.': { fr: 'Cet onglet charge la carte etudiante en mode administrateur. Lenregistreur ditineraire est disponible ici uniquement, afin que vous puissiez creer ou copier des trajets sans lexposer sur le tableau de bord etudiant.', pt: 'Esta aba carrega o mapa do aluno em modo administrador. O gravador de rotas esta disponivel apenas aqui, para criar ou copiar caminhos sem expor o gravador no painel do aluno.' },
        'User Management': { fr: 'Gestion des utilisateurs', pt: 'Gestao de usuarios' },
        'Timetable Management': { fr: 'Gestion de lhoraire', pt: 'Gestao de horario' },
        'Upload New Timetable': { fr: 'Televerser un nouvel horaire', pt: 'Enviar novo horario' },
        'Replace the existing timetable with new semester data. Supports Excel (.xlsx) and delimited text (.csv, .txt, .tsv) files.': { fr: 'Remplacez lhoraire existant par les nouvelles donnees du semestre. Prend en charge Excel (.xlsx) et les fichiers texte delimites (.csv, .txt, .tsv).', pt: 'Substitua o horario existente pelos novos dados do semestre. Suporta Excel (.xlsx) e arquivos de texto delimitados (.csv, .txt, .tsv).' },
        'Select Timetable File*': { fr: 'Selectionnez le fichier dhoraire*', pt: 'Selecione o arquivo de horario*' },
        'Drop your file here or click to browse': { fr: 'Deposez votre fichier ici ou cliquez pour parcourir', pt: 'Solte seu arquivo aqui ou clique para procurar' },
        'Current Timetable Status': { fr: 'Etat actuel de lhoraire', pt: 'Status atual do horario' },
        'Status': { fr: 'Statut', pt: 'Status' },
        'Total Classes': { fr: 'Total des cours', pt: 'Total de aulas' },
        'Unique Courses': { fr: 'Cours uniques', pt: 'Cursos unicos' },
        'Programs': { fr: 'Programmes', pt: 'Programas' },
        'Class Announcements': { fr: 'Annonces de cours', pt: 'Anuncios da aula' },
        'Post announcements and see notifications from student reps': { fr: 'Publiez des annonces et voyez les notifications des representants etudiants', pt: 'Publique anuncios e veja notificacoes dos representantes estudantis' },
        'Received from Student Reps': { fr: 'Recus des representants etudiants', pt: 'Recebidos dos representantes estudantis' },
        'Clear All': { fr: 'Tout effacer', pt: 'Limpar tudo' },
        'Select Class': { fr: 'Selectionner un cours', pt: 'Selecionar turma' },
        'Loading classes...': { fr: 'Chargement des cours...', pt: 'Carregando turmas...' },
        'Type of Announcement': { fr: 'Type dannonce', pt: 'Tipo de anuncio' },
        'General Information': { fr: 'Information generale', pt: 'Informacao geral' },
        'Class Delayed': { fr: 'Cours retarde', pt: 'Aula atrasada' },
        'Class Cancelled': { fr: 'Cours annule', pt: 'Aula cancelada' },
        'Test/Exam Alert': { fr: 'Alerte test/examen', pt: 'Alerta de teste/exame' },
        'Message': { fr: 'Message', pt: 'Mensagem' },
        'Enter your message to students...': { fr: 'Saisissez votre message aux etudiants...', pt: 'Digite sua mensagem para os alunos...' },
        'Post Announcement': { fr: 'Publier lannonce', pt: 'Publicar anuncio' },
        'My Recent Announcements': { fr: 'Mes annonces recentes', pt: 'Minhas anuncios recentes' },
        'No recent announcements': { fr: 'Aucune annonce recente', pt: 'Nenhum anuncio recente' },
        'Announcement Posted Successfully!': { fr: 'Annonce publiee avec succes !', pt: 'Anuncio publicado com sucesso!' },
        'Select a class...': { fr: 'Selectionnez un cours...', pt: 'Selecione uma turma...' },
        'No classes assigned': { fr: 'Aucun cours attribue', pt: 'Nenhuma turma atribuida' },
        'Sign Out': { fr: 'Se deconnecter', pt: 'Sair' },
        'Clear all received notifications?': { fr: 'Effacer toutes les notifications recues ?', pt: 'Limpar todas as notificacoes recebidas?' },
        'Loading classes...': { fr: 'Chargement des cours...', pt: 'Carregando turmas...' },
        'Post announcements and see notifications from student reps': { fr: 'Publiez des annonces et voyez les notifications des representants etudiants', pt: 'Publique anuncios e veja notificacoes dos representantes estudantis' },
        'Received from Student Reps': { fr: 'Recus des representants etudiants', pt: 'Recebidos dos representantes estudantis' },
        'Class Announcements': { fr: 'Annonces de cours', pt: 'Anuncios da aula' },
        'Select Class': { fr: 'Selectionner un cours', pt: 'Selecionar turma' },
        'Type of Announcement': { fr: 'Type dannonce', pt: 'Tipo de anuncio' },
        'General Information': { fr: 'Information generale', pt: 'Informacao geral' },
        'Class Delayed': { fr: 'Cours retarde', pt: 'Aula atrasada' },
        'Class Cancelled': { fr: 'Cours annule', pt: 'Aula cancelada' },
        'Test/Exam Alert': { fr: 'Alerte test/examen', pt: 'Alerta de teste/exame' },
        'Message': { fr: 'Message', pt: 'Mensagem' },
        'Enter your message to students...': { fr: 'Saisissez votre message aux etudiants...', pt: 'Digite sua mensagem para os alunos...' },
        'Post Announcement': { fr: 'Publier lannonce', pt: 'Publicar anuncio' },
        'My Recent Announcements': { fr: 'Mes annonces recentes', pt: 'Minhas anuncios recentes' },
        'User Management': { fr: 'Gestion des utilisateurs', pt: 'Gestao de usuarios' },
        'Timetable Management': { fr: 'Gestion de l\'horaire', pt: 'Gestao de horario' },
        'Send Notifications': { fr: 'Envoyer des notifications', pt: 'Enviar notificacoes' },
        'Custom Message': { fr: 'Message personnalise', pt: 'Mensagem personalizada' },
        'Search by name...': { fr: 'Rechercher par nom...', pt: 'Pesquisar por nome...' },
        'All Roles': { fr: 'Tous les roles', pt: 'Todos os cargos' },
        'Sign Out': { fr: 'Se deconnecter', pt: 'Sair' },
        'Help for new students: buildings, routes, and navigation tips.': { fr: 'Aide pour les nouveaux etudiants: batiments, trajets et conseils de navigation.', pt: 'Ajuda para novos estudantes: edificios, rotas e dicas de navegacao.' },
        'Navigation powered by OpenStreetMap': { fr: 'Navigation alimentee par OpenStreetMap', pt: 'Navegacao com OpenStreetMap' },
        'Key Locations': { fr: 'Lieux cles', pt: 'Locais principais' },
        'Get Directions': { fr: 'Obtenir un itineraire', pt: 'Obter direcoes' },
        'Navigate': { fr: 'Naviguer', pt: 'Navegar' },
        'Detect My Building': { fr: 'Detecter mon batiment', pt: 'Detectar meu edificio' },
        'Start Live Tracking': { fr: 'Demarrer le suivi en direct', pt: 'Iniciar rastreamento ao vivo' },
        'Stop Live Tracking': { fr: 'Arreter le suivi en direct', pt: 'Parar rastreamento ao vivo' }
        ,'Monday': { fr: 'Lundi', pt: 'Segunda-feira' }
        ,'Tuesday': { fr: 'Mardi', pt: 'Terca-feira' }
        ,'Wednesday': { fr: 'Mercredi', pt: 'Quarta-feira' }
        ,'Thursday': { fr: 'Jeudi', pt: 'Quinta-feira' }
        ,'Friday': { fr: 'Vendredi', pt: 'Sexta-feira' }
        ,'Welcome back': { fr: 'Bon retour', pt: 'Bem-vindo de volta' }
        ,'Mark Your Attendance': { fr: 'Marquez votre presence', pt: 'Marque sua presenca' }
        ,'Enter the 6-digit code from your lecturer to mark yourself present.': { fr: 'Entrez le code a 6 chiffres de votre enseignant pour vous marquer present.', pt: 'Digite o codigo de 6 digitos do professor para marcar sua presenca.' }
        ,'Scan QR': { fr: 'Scanner QR', pt: 'Ler QR' }
        ,'Enter Code': { fr: 'Entrer le code', pt: 'Inserir codigo' }
        ,'Overall Attendance': { fr: 'Presence globale', pt: 'Presenca geral' }
        ,'Classes Today': { fr: 'Cours aujourdhui', pt: 'Aulas hoje' }
        ,'Marked Present': { fr: 'Presence marquee', pt: 'Presenca registrada' }
        ,'Today\'s Classes': { fr: 'Cours daujourdhui', pt: 'Aulas de hoje' }
        ,'View Full Schedule': { fr: 'Voir tout lhoraire', pt: 'Ver horario completo' }
        ,'Quick Actions': { fr: 'Actions rapides', pt: 'Acoes rapidas' }
        ,'Open Rep Console': { fr: 'Ouvrir la console representant', pt: 'Abrir console do representante' }
        ,'Upcoming Classes': { fr: 'Cours a venir', pt: 'Aulas proximas' }
        ,'No Classes Today': { fr: 'Aucun cours aujourdhui', pt: 'Sem aulas hoje' }
        ,'Enjoy your free day!': { fr: 'Profitez de votre journee libre !', pt: 'Aproveite seu dia livre!' }
        ,'Present': { fr: 'Present', pt: 'Presente' }
        ,'Currently Teaching': { fr: 'En cours denseignement', pt: 'Lecionando agora' }
        ,'Next Class': { fr: 'Prochain cours', pt: 'Proxima aula' }
        ,'No More Classes Today': { fr: 'Plus de cours aujourdhui', pt: 'Sem mais aulas hoje' }
        ,'Generate QR Code': { fr: 'Generer le code QR', pt: 'Gerar codigo QR' }
        ,'Prepare QR Code': { fr: 'Preparer le code QR', pt: 'Preparar codigo QR' }
        ,'Prepare': { fr: 'Preparer', pt: 'Preparar' }
        ,'sessions/week': { fr: 'sessions/semaine', pt: 'sessoes/semana' }
        ,'Total Students': { fr: 'Total etudiants', pt: 'Total de estudantes' }
        ,'Avg Attendance': { fr: 'Presence moyenne', pt: 'Presenca media' }
        ,'View All': { fr: 'Voir tout', pt: 'Ver tudo' }
        ,'QR Code': { fr: 'Code QR', pt: 'Codigo QR' }
        ,'Manual': { fr: 'Manuel', pt: 'Manual' }
        ,'Click again to clear': { fr: 'Cliquez encore pour effacer', pt: 'Clique novamente para limpar' }
    };

    function exactTextFor(language, source) {
        if (!source) return null;
        const normalized = String(source).trim();
        if (!normalized) return null;

        const translation = TEXT_TRANSLATIONS[normalized] || PAGE_TITLES[normalized];
        if (!translation) return null;
        return translation[language] || translation.en || null;
    }

    function normalize(lang) {
        const short = String(lang || '').toLowerCase().slice(0, 2);
        return SUPPORTED.includes(short) ? short : 'en';
    }

    function detectFromDevice() {
        const raw = (navigator.languages && navigator.languages[0]) || navigator.language || 'en';
        return normalize(raw);
    }

    function getStoredUser() {
        try {
            const raw = sessionStorage.getItem('upath_user');
            return raw ? JSON.parse(raw) : null;
        } catch (_) {
            return null;
        }
    }

    function currentLanguage() {
        const user = getStoredUser();
        if (user && user.language) return normalize(user.language);

        const persisted = localStorage.getItem('upath_lang');
        if (persisted) return normalize(persisted);

        return detectFromDevice();
    }

    function setLanguage(lang) {
        const safe = normalize(lang);
        localStorage.setItem('upath_lang', safe);
        document.documentElement.lang = safe;

        const user = getStoredUser();
        if (user) {
            user.language = safe;
            sessionStorage.setItem('upath_user', JSON.stringify(user));
        }

        apply();
        return safe;
    }

    function t(key) {
        const lang = currentLanguage();
        return (DICT[lang] && DICT[lang][key]) || DICT.en[key] || key;
    }

    function translateElementText(node, language) {
        if (!node || !node.tagName) return;
        const tag = node.tagName.toLowerCase();
        if (['script', 'style', 'noscript'].includes(tag)) return;

        const text = node.textContent && node.textContent.trim();
        if (!text) return;

        const exact = exactTextFor(language, text);
        if (exact) {
            node.textContent = exact;
        }
    }

    function apply(root) {
        const target = root || document;
        const language = currentLanguage();

        target.querySelectorAll('[data-i18n]').forEach((node) => {
            const key = node.getAttribute('data-i18n');
            node.textContent = t(key);
        });
        target.querySelectorAll('[data-i18n-placeholder]').forEach((node) => {
            const key = node.getAttribute('data-i18n-placeholder');
            node.setAttribute('placeholder', t(key));
        });
        target.querySelectorAll('[data-i18n-title]').forEach((node) => {
            const key = node.getAttribute('data-i18n-title');
            node.setAttribute('title', t(key));
        });
        target.querySelectorAll('[data-i18n-value]').forEach((node) => {
            const key = node.getAttribute('data-i18n-value');
            node.setAttribute('value', t(key));
        });

        const walker = document.createTreeWalker(target.body || target, NodeFilter.SHOW_ELEMENT);
        while (walker.nextNode()) {
            const element = walker.currentNode;
            if (element.hasAttribute && (element.hasAttribute('data-i18n') || element.hasAttribute('data-i18n-placeholder') || element.hasAttribute('data-i18n-title') || element.hasAttribute('data-i18n-value'))) {
                continue;
            }
            translateElementText(element, language);
        }

        const title = document.title;
        const translatedTitle = exactTextFor(language, title);
        if (translatedTitle) {
            document.title = translatedTitle;
        }

        const htmlLang = currentLanguage();
        document.documentElement.lang = htmlLang;
    }

    function observeDynamicContent() {
        if (!window.MutationObserver || !document.body) return;

        let scheduled = false;
        let applying = false;

        const scheduleApply = () => {
            if (scheduled || applying) return;
            scheduled = true;
            const run = () => {
                scheduled = false;
                applying = true;
                try {
                    apply(document);
                } finally {
                    applying = false;
                }
            };

            if (window.requestAnimationFrame) {
                window.requestAnimationFrame(run);
            } else {
                setTimeout(run, 16);
            }
        };

        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'childList') {
                    if (mutation.addedNodes && mutation.addedNodes.length) {
                        scheduleApply();
                        return;
                    }
                }
                if (mutation.type === 'characterData') {
                    scheduleApply();
                    return;
                }
                if (mutation.type === 'attributes') {
                    if (mutation.attributeName === 'data-i18n' || mutation.attributeName === 'placeholder' || mutation.attributeName === 'title' || mutation.attributeName === 'value') {
                        scheduleApply();
                        return;
                    }
                }
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: true,
            attributeFilter: ['data-i18n', 'data-i18n-placeholder', 'data-i18n-title', 'data-i18n-value', 'placeholder', 'title', 'value']
        });
    }

    window.I18N = {
        supported: SUPPORTED,
        detectFromDevice,
        currentLanguage,
        setLanguage,
        t,
        apply
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            document.documentElement.lang = currentLanguage();
            apply();
            observeDynamicContent();
        });
    } else {
        document.documentElement.lang = currentLanguage();
        apply();
        observeDynamicContent();
    }

    window.addEventListener('storage', (event) => {
        if (event.key === 'upath_lang') {
            document.documentElement.lang = currentLanguage();
            apply();
        }
    });
})();
