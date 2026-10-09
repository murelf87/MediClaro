import {AppHeader,Screen} from '../src/components';
import {ProfileChoice} from '../src/components/ProfileChoice';
export default function ChooseProfile(){return <Screen header={<AppHeader title="Elige tu perfil" fallbackHref="/welcome"/>}><ProfileChoice/></Screen>;}
